import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadRulesConfig, loadMappingConfig } from './core/config-loader';
import { compileRules } from './core/rule-engine';
import { AutosortPaths } from './core/types';
import { ensureDirSync } from './core/file-operations';
import { ClassifierConfig, handleFile } from './services/classifier';
import { FileWatcher, WatchedFolder } from './services/watcher';
import {
  initDatabase,
  getWatchedFolders,
  addWatchedFolder,
  getSetting,
  setSetting,
  persistDb,
  DatabaseInstance,
} from './services/database';
import { runLegacyMigration } from './services/migration';
import { warmup } from './core/llm-client';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let fileWatcher: FileWatcher | null = null;
let db: DatabaseInstance | null = null;
let classifierConfig: ClassifierConfig | null = null;
let activeCount = 0;
const MAX_CONCURRENT = 3;
const pendingQueue: string[] = [];

const DEFAULT_ROOT = process.env.AUTOSORT_BASE || 'C:\\_AUTOSORT';

function boolFromDb(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

async function processNext(): Promise<void> {
  if (!fileWatcher || !classifierConfig || activeCount >= MAX_CONCURRENT) {
    return;
  }

  const filePath = pendingQueue.shift();
  if (!filePath) return;

  activeCount += 1;
  try {
    const result = await handleFile(classifierConfig, filePath);
    if (result) {
      mainWindow?.webContents.send('file:processed', result);
    }
  } catch (e) {
    console.error(`Error processing file: ${filePath}`, e);
  } finally {
    activeCount -= 1;
    await processNext();
  }
}

function createPaths(root: string): AutosortPaths {
  return {
    root,
    staging: path.join(root, 'staging'),
    out: path.join(root, 'out'),
    quarantine: path.join(root, 'quarantine'),
    dup: path.join(root, 'dup'),
    logs: path.join(root, 'logs'),
    cache: path.join(root, 'cache'),
    rules_dir: path.join(root, 'rules'),
  };
}

function ensureAllDirs(paths: AutosortPaths): void {
  for (const p of Object.values(paths)) {
    ensureDirSync(p);
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Autosort Desktop',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icons', 'tray-icon.png');
  let trayIcon: Electron.NativeImage;

  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a simple 16x16 icon as fallback
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Autosort Desktop');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Pause Watching',
      type: 'checkbox',
      checked: false,
      click: async (menuItem) => {
        if (menuItem.checked) {
          await fileWatcher?.close();
        } else {
          await startWatching();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        tray = null;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
}

async function startWatching(): Promise<void> {
  if (!db || !classifierConfig) return;

  if (fileWatcher) {
    await fileWatcher.close();
  }
  pendingQueue.length = 0;
  activeCount = 0;

  fileWatcher = new FileWatcher(2000);

  fileWatcher.on('file', async (filePath: string) => {
    pendingQueue.push(filePath);
    await processNext();
  });

  const folders = getWatchedFolders(db) as unknown as WatchedFolder[];
  for (const folder of folders) {
    const rawEnabled = folder.enabled as unknown;
    const enabled =
      rawEnabled === true ||
      rawEnabled === 1 ||
      rawEnabled === '1' ||
      rawEnabled === 'true' ||
      (typeof rawEnabled === 'string' && rawEnabled.toLowerCase() === 'true') ||
      (typeof rawEnabled === 'number' && rawEnabled === 1);
    if (enabled) {
      await fileWatcher.addFolder(folder);
      const sweepKey = `sweep_done_${folder.id}`;
      const shouldSweep = getSetting(db, sweepKey) !== 'true';
      if (shouldSweep) {
        await fileWatcher.sweepExisting(folder.path, boolFromDb(folder.recursive));
        setSetting(db, sweepKey, 'true');
      }
      console.log(`Watching: ${folder.path}`);
    }
  }
}

async function initApp(): Promise<void> {
  // Initialize paths
  const autosortPaths = createPaths(DEFAULT_ROOT);
  ensureAllDirs(autosortPaths);

  // Initialize database
  const dbPath = path.join(autosortPaths.root, 'data', 'autosort.db');
  db = await initDatabase(dbPath);

  // Check if bundled rules should be used
  const bundledRulesDir = path.join(__dirname, '..', '..', 'rules');
  const rulesDir = fs.existsSync(path.join(autosortPaths.rules_dir, 'rules.yaml'))
    ? autosortPaths.rules_dir
    : bundledRulesDir;

  // Load rules
  const rulesCfg = loadRulesConfig(rulesDir);
  const mappingCfg = loadMappingConfig(rulesDir);

  if (!rulesCfg || !rulesCfg.rules) {
    console.error(`Error: rules.yaml not found in ${rulesDir}`);
    return;
  }

  const compileResult = compileRules(rulesCfg);
  console.log(`Rules loaded: ${compileResult.compiled_rules.length} rules from ${rulesDir}`);

  // Setup classifier config
  const llmUrl = getSetting(db, 'llm_url') || 'http://127.0.0.1:8080/v1';
  const llmType = (getSetting(db, 'llm_type') || 'llama_cpp') as 'llama_cpp' | 'ollama';

  classifierConfig = {
    paths: autosortPaths,
    llmBaseUrl: llmUrl,
    llmType,
    rulesCfg,
    mappingCfg,
    compileResult,
    cachePath: path.join(autosortPaths.cache, 'cache.json'),
    ledgerPath: path.join(autosortPaths.logs, 'ledger.jsonl'),
    dryRun: false,
    db,
  };

  // LLM warmup (non-blocking)
  warmup(llmUrl).then(() => {
    console.log(`LLM OK: ${llmUrl} (type=${llmType})`);
  }).catch(() => {
    console.warn('LLM warmup failed (will retry on use)');
  });

  // Add default watched folder if none exist
  const folders = getWatchedFolders(db);
  if ((folders as unknown[]).length === 0) {
    const downloadsPath = path.join(
      process.env.USERPROFILE || process.env.HOME || '',
      'Downloads'
    );
    if (fs.existsSync(downloadsPath)) {
      addWatchedFolder(db, downloadsPath, 'Downloads', false);
    }
  }

  // One-time legacy migration (cache/ledger -> sqlite)
  await runLegacyMigration(db, autosortPaths);

  // Register IPC handlers
  registerIpcHandlers(db, classifierConfig, fileWatcher);

  // Start watching
  await startWatching();
}

app.whenReady().then(async () => {
  await initApp();
  createMainWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit on window close (tray app)
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) {
    createMainWindow();
  }
});

app.on('before-quit', async () => {
  await fileWatcher?.close();
  if (db) {
    persistDb(db);
    db.close();
  }
});
