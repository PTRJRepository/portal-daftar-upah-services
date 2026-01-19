class GangRepository:
    def __init__(self):
        self.divmap = {
            'PG1A': 'A', 'PG1B': 'B', 'PG2A': 'C', 'PG2B': 'D', 'DME': 'E', 'ARA': 'F',
            'ARB1': 'G', 'ARB2': 'H', 'INFRA': 'I', 'AREC': 'J', 'IJL': 'IJL', 'STF-OFFICE': 'STF', 'SECURITY': 'SEC'
        }
        self.data = {
            'PG1A': ['A1A','A2A','A3A'],
            'PG1B': ['B1B','B2B'],
            'PG2A': ['C1C','C2C'],
            'PG2B': ['D1D','D2D','D3D'],
            'DME': ['E1E'],
            'ARA': ['F1F','F2F'],
            'ARB1': ['G1G','G2G'],
            'ARB2': ['H1H','H2H','H3H'],
            'INFRA': ['I1I'],
            'AREC': ['J1J','J2J'],
            'IJL': ['IJL1','IJL2'],
            'STF-OFFICE': ['STF1','STF2'],
            'SECURITY': ['SEC1','SEC2']
        }

    def list(self, division: str = None):
        if division and division in self.data:
            return sorted(self.data[division])
        # flatten all
        all_codes = []
        for v in self.data.values():
            all_codes.extend(v)
        return sorted(all_codes)
