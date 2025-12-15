# Script to extract page templates from index.html
# This script reads index.html and extracts each section into separate template files

$indexPath = "index.html"
$templatesDir = "public\templates\pages"

# Ensure templates directory exists
if (-not (Test-Path $templatesDir)) {
    New-Item -ItemType Directory -Force -Path $templatesDir
}

# Read the entire file
$content = Get-Content $indexPath -Raw

# Define the pages to extract (based on section patterns)
$pages = @(
    @{ Id = "welcomeCard"; FileName = "welcome.html"; StartLine = 293; EndLine = 514 },
    @{ Id = "entryCard"; FileName = "entry.html"; StartLine = 517; EndLine = 689 },
    @{ Id = "newUserCard"; FileName = "new-user.html"; StartLine = 692; EndLine = 885 },
    @{ Id = "setPasswordCard"; FileName = "set-password.html"; StartLine = 888; EndLine = 1060 },
    @{ Id = "loginCard"; FileName = "login.html"; StartLine = 1063; EndLine = 1345 },
    @{ Id = "importCard"; FileName = "import.html"; StartLine = 1348; EndLine = 1591 },
    @{ Id = "nextCard"; FileName = "join-group.html"; StartLine = 1594; EndLine = 1879 },
    @{ Id = "inquiryCard"; FileName = "inquiry.html"; StartLine = 1881; EndLine = 1972 },
    @{ Id = "walletCard"; FileName = "wallet.html"; StartLine = 1974; EndLine = 2520 },
    @{ Id = "groupDetailCard"; FileName = "group-detail.html"; StartLine = 2529; EndLine = 2763 },
    @{ Id = "profileCard"; FileName = "profile.html"; StartLine = 2766; EndLine = 3067 },
    @{ Id = "historyCard"; FileName = "history.html"; StartLine = 3264; EndLine = 3390 }
)

# Read all lines
$lines = Get-Content $indexPath

foreach ($page in $pages) {
    $startIdx = $page.StartLine - 1
    $endIdx = $page.EndLine - 1
    
    # Extract lines for this section
    $sectionLines = $lines[$startIdx..$endIdx]
    $sectionContent = $sectionLines -join "`r`n"
    
    # Add comment header
    $header = "<!-- `r`n  Page Template: $($page.Id)`r`n  File: /templates/pages/$($page.FileName)`r`n  Extracted from index.html`r`n-->`r`n"
    $fullContent = $header + $sectionContent
    
    # Write to template file
    $outputPath = Join-Path $templatesDir $page.FileName
    $fullContent | Out-File -FilePath $outputPath -Encoding UTF8
    
    Write-Host "Extracted $($page.Id) -> $outputPath"
}

Write-Host "`nDone! Extracted $($pages.Count) page templates."
