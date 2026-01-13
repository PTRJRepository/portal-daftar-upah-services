
import csv

def extract_divisions():
    file_path = "database_agregasi.txt"
    divisions = set()
    
    with open(file_path, "r", encoding="utf-8") as f:
        first_line = f.readline()
        delimiter = "\t" if "\t" in first_line else ","
        f.seek(0)
        
        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            code = row.get("division_code")
            if code and code != "NULL":
                divisions.add(code)
                
    print("Found divisions:", sorted(list(divisions)))

if __name__ == "__main__":
    extract_divisions()
