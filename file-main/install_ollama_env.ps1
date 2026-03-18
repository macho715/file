# Ollama 모델 저장 경로 고정 (가이드 권장)
[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", "C:\_ollama_models", "User")
Write-Host "OLLAMA_MODELS = C:\_ollama_models (User env set. Restart terminal to use.)"
