import re

with open('backend/mobile_routes.py', 'r') as f:
    content = f.read()

pattern = r'([ \t]*)except Exception as e:\n([ \t]*)raise HTTPException\(status_code=500, detail=str\(e\)\)'
replacement = r'\1except HTTPException:\n\1    raise\n\1except Exception as e:\n\2raise HTTPException(status_code=500, detail=str(e))'

new_content = re.sub(pattern, replacement, content)

with open('backend/mobile_routes.py', 'w') as f:
    f.write(new_content)
