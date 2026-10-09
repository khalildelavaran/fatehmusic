import os, re

missing = set()
for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith((".js", ".ts", ".astro")):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                matches = re.findall(r"/images/[a-zA-Z0-9_\-\.\/]+", content)
                for m in matches:
                    clean = re.sub(r"['\"`\)\};,].*$", "", m)
                    if not os.path.exists(os.path.join("public", clean.lstrip("/"))):
                        missing.add((clean, filepath))

for img, src in sorted(missing):
    print(f"{img} referenced in {src}")
