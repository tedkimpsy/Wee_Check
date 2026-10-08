$ErrorActionPreference = 'Stop'
if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
  Write-Host 'cloudflared가 이미 설치되어 있습니다.'
  exit 0
}
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'winget을 찾을 수 없습니다. Cloudflare 공식 문서에 따라 cloudflared를 설치해 주세요.' }
winget install --id Cloudflare.cloudflared --exact --accept-package-agreements --accept-source-agreements
Write-Host '설치 후 Wee Check를 다시 시작해 주세요.'
