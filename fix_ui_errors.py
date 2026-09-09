import os
import re

directory = 'erpapp/src/Screens/Wms'
pattern = re.compile(r"Alert\.alert\('([^']*)',\s*'Operation failed\. Please try again\.'\);")
replacement = r"Alert.alert('\1', err.message || 'Operation failed. Please try again.');"

for filename in os.listdir(directory):
    if filename.endswith(".tsx"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r') as f:
            content = f.read()
        
        new_content = pattern.sub(replacement, content)
        
        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Fixed {filename}")
