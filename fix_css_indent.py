import re

# Read the CSS file
with open(r'c:\Users\18360\Desktop\Code\TransferAreaInterface\style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Process lines 4164 onwards (0-indexed, so 4163)
fixed_lines = []
for i, line in enumerate(lines):
    if i >= 4163 and line.startswith('  .') or (i >= 4163 and line.startswith('  @')):
        # Remove first 2 spaces from rules that start with .  or  @
        fixed_lines.append(line[2:])
    else:
        fixed_lines.append(line)

# Write back
with open(r'c:\Users\18360\Desktop\Code\TransferAreaInterface\style.css', 'w', encoding='utf-8', newline='') as f:
    f.writelines(fixed_lines)

print("Fixed CSS indentation")
