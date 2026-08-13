import pandas as pd

pd.read_csv('synthetic_ericsson_tickets_v3.csv').to_excel('synthetic_ericsson_tickets_v3.xlsx', index=False)
pd.read_csv('synthetic_ericsson_tickets_realistic.csv').to_excel('synthetic_ericsson_tickets_realistic.xlsx', index=False)

print("Excel files created successfully in your folder!")