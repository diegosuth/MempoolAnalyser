
# # Análisis Comparativo de Algoritmos de Construcción de Bloques
# ---
# Este script carga los resultados de los algoritmos Greedy, FCFS y los datos reales de la red (Mined) para realizar un análisis comparativo exhaustivo.
# **Versión Final:** Estandariza la carga de datos (asumiendo Wei) y mejora las visualizaciones.

# %%
# =================================================================
# 1. CONFIGURACIÓN E IMPORTACIÓN DE LIBRERÍAS
# =================================================================
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# --- NOMBRES DE LOS ARCHIVOS CSV ---
GREEDY_CSV = 'greedy_results_fixed.csv'
FCFS_CSV = 'fcfs_results.csv'
MINED_CSV = 'mined_transactions_data.csv'

OUTLIER_QUANTILE = 0.99

NUMERIC_COLS_BASE = [
    'BlockReward', 'GananciaxTransaccion', 'BlockGas',
    'GasUsed', 'BaseFee', 'BlockNumber', 'TransactionType'
]

print("Librerías importadas y configuración inicial completada.")

# %%
# =================================================================
# 2. FUNCIÓN DE CARGA Y LIMPIEZA DE DATOS (ESTANDARIZADA)
# =================================================================
def load_and_clean_csv(filepath):
    """
    Carga un archivo CSV, asumiendo que todas las unidades monetarias están en Wei,
    las convierte a ETH, y filtra outliers.
    """
    try:
        df = pd.read_csv(filepath)
        print(f"Archivo '{filepath}' cargado exitosamente. {len(df)} filas.")
    except FileNotFoundError:
        print(f"Error: El archivo '{filepath}' no fue encontrado.")
        return None

    for col_base in NUMERIC_COLS_BASE:
        if col_base in df.columns:
            df[col_base] = pd.to_numeric(df[col_base], errors='coerce')
    df.fillna(0, inplace=True)

    WEI_TO_ETH_DIVISOR = 1e18

    if 'GananciaxTransaccion' in df.columns:
        df['GananciaxTransaccion(ETH)'] = df['GananciaxTransaccion'] / WEI_TO_ETH_DIVISOR
        df.drop(columns=['GananciaxTransaccion'], inplace=True)
        
    if 'BlockReward' in df.columns:
        df['BlockReward(ETH)'] = df['BlockReward'] / WEI_TO_ETH_DIVISOR
        df.drop(columns=['BlockReward'], inplace=True)
        
    if 'BaseFee' in df.columns:
        df['BaseFee(ETH)'] = df['BaseFee'] / WEI_TO_ETH_DIVISOR
    
    if 'GananciaxTransaccion(ETH)' in df.columns:
        initial_rows = len(df)
        outlier_threshold = df['GananciaxTransaccion(ETH)'].quantile(OUTLIER_QUANTILE)
        df = df[df['GananciaxTransaccion(ETH)'] <= outlier_threshold]
        removed_rows = initial_rows - len(df)
        if removed_rows > 0:
            print(f"   -> Se eliminaron {removed_rows} transacciones atípicas de '{filepath}'.")

    return df

print("Función de carga y limpieza de datos definida.")


# %%
# =================================================================
# 3. FUNCIÓN PRINCIPAL DE ANÁLISIS
# =================================================================
def analizar_escenario(df_greedy, df_fcfs, df_mined, titulo_escenario):
    """
    Ejecuta todas las métricas y análisis para un conjunto de datos dado.
    """
    print("\n" + "="*80)
    print(f"INICIANDO: {titulo_escenario.upper()}")
    print("="*80 + "\n")

    # --- 1. Gráfico de Ganancias por Bloque ---
    print("--- 1. Gráfico de Ganancias por Bloque ---")
    
    greedy_rewards = df_greedy.groupby('BlockNumber')['BlockReward(ETH)'].sum()
    fcfs_rewards = df_fcfs.groupby('BlockNumber')['BlockReward(ETH)'].sum()
    
    if not df_mined.empty:
        df_mined['NormalizedBlockNumber'] = df_mined['BlockNumber'] - df_mined['BlockNumber'].min() + 1
        mined_rewards = df_mined.groupby('NormalizedBlockNumber')['BlockReward(ETH)'].sum()
    else:
        mined_rewards = pd.Series()

    def filter_block_outliers_for_plot(rewards_series, name):
        if rewards_series.empty: return rewards_series
        initial_blocks = len(rewards_series)
        block_outlier_threshold = rewards_series.quantile(OUTLIER_QUANTILE)
        filtered_rewards = rewards_series[rewards_series <= block_outlier_threshold]
        removed_blocks = initial_blocks - len(filtered_rewards)
        if removed_blocks > 0:
            print(f"   -> Para el gráfico, se eliminaron {removed_blocks} bloques atípicos de '{name}'.")
        return filtered_rewards

    greedy_rewards_plot = filter_block_outliers_for_plot(greedy_rewards, "Greedy")
    fcfs_rewards_plot = filter_block_outliers_for_plot(fcfs_rewards, "FCFS")
    mined_rewards_plot = filter_block_outliers_for_plot(mined_rewards, "Mined")
    
    fig, axes = plt.subplots(3, 1, figsize=(15, 18), sharex=True)
    fig.suptitle(f'Ganancia por Bloque - {titulo_escenario} (Sin Outliers en Gráfico)', fontsize=16)

    axes[0].plot(greedy_rewards_plot.index, greedy_rewards_plot.values, label='Greedy', color='blue', marker='o', linestyle='-', markersize=3, alpha=0.7)
    axes[0].set_title('Algoritmo Greedy')
    axes[0].set_ylabel('Ganancia del Bloque (ETH)')
    axes[0].grid(True, which='both', linestyle='--', linewidth=0.5)
    axes[0].legend()

    axes[1].plot(fcfs_rewards_plot.index, fcfs_rewards_plot.values, label='FCFS', color='orange', marker='x', linestyle='-', markersize=3, alpha=0.7)
    axes[1].set_title('Algoritmo FCFS')
    axes[1].set_ylabel('Ganancia del Bloque (ETH)')
    axes[1].grid(True, which='both', linestyle='--', linewidth=0.5)
    axes[1].legend()

    if not mined_rewards_plot.empty:
        axes[2].plot(mined_rewards_plot.index, mined_rewards_plot.values, label='Mined (Real)', color='gray', marker='.', linestyle='-', markersize=3, alpha=0.7)
    axes[2].set_title('Red Real (Mined)')
    axes[2].set_xlabel('Número de Bloque (Normalizado para Mined)')
    axes[2].set_ylabel('Ganancia del Bloque (ETH)')
    axes[2].grid(True, which='both', linestyle='--', linewidth=0.5)
    axes[2].legend()

    plt.tight_layout(rect=[0, 0.03, 1, 0.96])
    plt.show()
    print("Gráfico generado.\n")

    # --- Métricas Generales y por Bloque ---
    print("--- Métricas Generales y por Bloque ---")
    datasets = {'Greedy': df_greedy, 'FCFS': df_fcfs, 'Mined': df_mined}
    for name, df in datasets.items():
        if df.empty:
            print(f"\n--- {name}: Sin datos para analizar. ---")
            continue

        total_ganancia = df['BlockReward(ETH)'].sum()
        cantidad_bloques = df['BlockNumber'].nunique()
        
        print(f"\n--- {name} ---")
        print(f"1.1) Ganancia Total: {total_ganancia:,.6f} ETH")
        print(f"1.1) Cantidad de Bloques: {cantidad_bloques}")

        if name == 'Mined' and 'BaseFee(ETH)' in df.columns:
            df['TotalBaseFeeCost_ETH'] = df['BaseFee(ETH)'] * df['GasUsed']
            total_quemado_eth = df['TotalBaseFeeCost_ETH'].sum()
            print(f"1.3) Total Quemado (BaseFee): {total_quemado_eth:,.6f} ETH")
        
        ganancia_promedio_bloque = total_ganancia / cantidad_bloques if cantidad_bloques > 0 else 0
        frecuencia_bloques = cantidad_bloques / 3600 if cantidad_bloques > 0 else 0
        print(f"1.4) Ganancia promedio por bloque: {ganancia_promedio_bloque:,.8f} ETH")
        print(f"1.4) Frecuencia de bloques: {frecuencia_bloques:.4f} bloques/segundo (asumiendo 1 hora de datos)")

        block_gas_series = df[df['BlockGas'] > 0]['BlockGas']
        ocupancia_promedio = block_gas_series.mean() if not block_gas_series.empty else 0
        print(f"1.5) Ocupancia promedio por bloque: {ocupancia_promedio:,.2f} Gas")

        print("\n1.2) Top 5 Transacciones Más Valiosas:")
        top_5_txs = df.nlargest(5, 'GananciaxTransaccion(ETH)')
        print(top_5_txs[['TransactionHash', 'GananciaxTransaccion(ETH)']].to_string(index=False, float_format="%.8f"))
        
        print("\n1.6) Top 5 Bloques Más Valiosos:")
        block_rewards = df.groupby('BlockNumber')['BlockReward(ETH)'].sum()
        top_5_blocks = block_rewards.nlargest(5)
        print(top_5_blocks.to_string())

    # --- Análisis de Coincidencias, Latencia y Similitud ---
    print("\n\n--- 2. Análisis de Coincidencias, Latencia y Similitud ---")
    if not df_mined.empty:
        set_mined_total = set(df_mined['TransactionHash'])
        for name, df_algo in [('Greedy', df_greedy), ('FCFS', df_fcfs)]:
            if not df_algo.empty:
                set_algo = set(df_algo['TransactionHash'])
                coincidencias = len(set_algo.intersection(set_mined_total))
                porcentaje = (coincidencias / len(set_mined_total)) * 100 if len(set_mined_total) > 0 else 0
                print(f"2) Coincidencias {name} vs Mined: {coincidencias} de {len(set_mined_total)} ({porcentaje:.2f}%)")
        
        if not df_fcfs.empty:
            df_fcfs_latency = df_fcfs[['TransactionHash', 'BlockNumber']].rename(columns={'BlockNumber': 'BlockNumber_fcfs'})
            df_mined_latency = df_mined[['TransactionHash', 'NormalizedBlockNumber']].rename(columns={'NormalizedBlockNumber': 'BlockNumber_mined'})
            merged_df = pd.merge(df_fcfs_latency, df_mined_latency, on='TransactionHash')
            
            if not merged_df.empty:
                merged_df['LatenciaEnBloques'] = merged_df['BlockNumber_mined'] - merged_df['BlockNumber_fcfs']
                latencia_promedio = merged_df['LatenciaEnBloques'].mean()
                print(f"2.1) Latencia promedio (FCFS vs Mined): {latencia_promedio:.2f} bloques")
            else:
                print("2.1) No hay transacciones coincidentes para calcular la latencia.")
            
            print("\n--- 2.2) Similitud de Contenido de Bloques (FCFS vs Mined) ---")
            fcfs_blocks = df_fcfs.groupby('BlockNumber')['TransactionHash'].apply(set)
            mined_blocks = df_mined.groupby('NormalizedBlockNumber')['TransactionHash'].apply(set)
            jaccard_scores = []
            for block_num, fcfs_tx_set in fcfs_blocks.items():
                if block_num in mined_blocks.index:
                    mined_tx_set = mined_blocks[block_num]
                    intersection_size = len(fcfs_tx_set.intersection(mined_tx_set))
                    union_size = len(fcfs_tx_set.union(mined_tx_set))
                    jaccard_similarity = intersection_size / union_size if union_size > 0 else 1.0
                    jaccard_scores.append(jaccard_similarity)
            
            if jaccard_scores:
                average_jaccard_index = np.mean(jaccard_scores)
                print(f"Similitud promedio de bloques (Índice de Jaccard): {average_jaccard_index:.4f}")
            else:
                print("No se encontraron bloques alineados para calcular la similitud.")
    else:
        print("No se pueden realizar análisis de comparación porque el archivo 'Mined' no se cargó.")

    print("\n" + "="*80)
    print(f"FIN DEL ANÁLISIS: {titulo_escenario.upper()}")
    print("="*80 + "\n")

# %%
# =================================================================
# 4. EJECUCIÓN DE LOS ANÁLISIS
# =================================================================
if __name__ == '__main__':
    df_greedy_orig = load_and_clean_csv(GREEDY_CSV)
    df_fcfs_orig = load_and_clean_csv(FCFS_CSV)
    df_mined_orig = load_and_clean_csv(MINED_CSV)

    if all(df is not None for df in [df_greedy_orig, df_fcfs_orig, df_mined_orig]):
        analizar_escenario(
            df_greedy_orig.copy(), 
            df_fcfs_orig.copy(), 
            df_mined_orig.copy(), 
            "Análisis Completo (Todas las Transacciones)"
        )
        analizar_escenario(
            df_greedy_orig[df_greedy_orig['TransactionType'] != 2].copy(),
            df_fcfs_orig[df_fcfs_orig['TransactionType'] != 2].copy(),
            df_mined_orig[df_mined_orig['TransactionType'] != 2].copy(),
            "Análisis Excluyendo Transacciones Tipo 2"
        )
        analizar_escenario(
            df_greedy_orig[df_greedy_orig['TransactionType'] == 2].copy(),
            df_fcfs_orig[df_fcfs_orig['TransactionType'] == 2].copy(),
            df_mined_orig[df_mined_orig['TransactionType'] == 2].copy(),
            "Análisis con Solo Transacciones Tipo 2"
        )
    else:
        print("\nUno o más archivos CSV no se pudieron cargar. El análisis se ha detenido.")
