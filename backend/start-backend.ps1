$condaHook = "C:\Users\Ethan\miniconda3\shell\condabin\conda-hook.ps1"
$pythonExe = "C:\Users\Ethan\miniconda3\python.exe"

if (Test-Path $condaHook) {
    & $condaHook
    conda activate base
}

& $pythonExe -m uvicorn app.main:app --reload
