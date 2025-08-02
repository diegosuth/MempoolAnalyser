
# # Análisis Comparativo de Algoritmos de Construcción de Bloques
# ---
# **Versión Final y Optimizada:** Este script carga los resultados de los algoritmos Greedy, FCFS y los datos reales de la red (Mined) para realizar un análisis comparativo exhaustivo.

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

# --- CONFIGURACIÓN DEL FILTRO DE OUTLIERS ---
OUTLIER_QUANTILE = 0.99

print("Librerías importadas y configuración inicial completada.")

# %%
# =================================================================
# 2. FUNCIÓN DE CARGA Y LIMPIEZA DE DATOS
# =================================================================
def load_and_clean_csv(filepath):
    """
    Carga un archivo CSV, estandariza columnas, convierte unidades de Wei a ETH,
    y filtra outliers de transacciones.
    """
    try:
        df = pd.read_csv(filepath)
        print(f"Archivo '{filepath}' cargado exitosamente. {len(df)} filas.")
    except FileNotFoundError:
        print(f"Error: El archivo '{filepath}' no fue encontrado.")
        return None

    # Estandarizar nombres para consistencia
    rename_map = {
        'BlockReward(Gwei)': 'BlockReward', 'GananciaxTransaccion(Gwei)': 'GananciaxTransaccion',
        'BaseFee(Gwei)': 'BaseFee', 'GananciaxTransaccion(post BaseFee)': 'GananciaxTransaccion'
    }
    df.rename(columns=rename_map, inplace=True)
    
    # Asegurar que las columnas necesarias existan, aunque estén vacías
    required_cols = ['BlockReward', 'GananciaxTransaccion', 'BlockGas', 'GasUsed', 'BaseFee', 'BlockNumber', 'TransactionType', 'TimeStamp']
    for col in required_cols:
        if col not in df.columns:
            df[col] = 0

    # Convertir columnas a numérico
    numeric_cols = ['BlockReward', 'GananciaxTransaccion', 'BlockGas', 'GasUsed', 'BaseFee', 'BlockNumber', 'TransactionType']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df.fillna(0, inplace=True)
    
    # Convertir TimeStamp a formato de fecha y hora
    if 'TimeStamp' in df.columns:
        df['TimeStamp'] = pd.to_datetime(df['TimeStamp'], errors='coerce')

    # Convertir unidades de Wei a ETH
    WEI_TO_ETH = 1e18
    df['GananciaxTransaccion(ETH)'] = df['GananciaxTransaccion'] / WEI_TO_ETH
    df['BlockReward(ETH)'] = df['BlockReward'] / WEI_TO_ETH
    df['BaseFee(ETH)'] = df['BaseFee'] / WEI_TO_ETH
    
    # Filtrar Outliers a nivel de Transacción
    if not df.empty and 'GananciaxTransaccion(ETH)' in df.columns:
        initial_rows = len(df)
        # Se calcula el umbral solo con valores mayores a cero para evitar problemas con transacciones sin ganancia
        positive_gains = df[df['GananciaxTransaccion(ETH)'] > 0]['GananciaxTransaccion(ETH)']
        if not positive_gains.empty:
            outlier_threshold = positive_gains.quantile(OUTLIER_QUANTILE)
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
    Ejecuta y muestra todas las métricas y análisis para un conjunto de datos.
    """
    print("\n" + "="*80)
    print(f"INICIANDO: {titulo_escenario.upper()}")
    print("="*80 + "\n")

    datasets = {'Greedy': df_greedy, 'FCFS': df_fcfs, 'Mined': df_mined}

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
        positive_rewards = rewards_series[rewards_series > 0]
        if positive_rewards.empty: return rewards_series
        outlier_threshold = positive_rewards.quantile(OUTLIER_QUANTILE)
        filtered_rewards = rewards_series[rewards_series <= outlier_threshold]
        if len(rewards_series) > len(filtered_rewards):
            print(f"   -> Para el gráfico, se eliminaron {len(rewards_series) - len(filtered_rewards)} bloques atípicos de '{name}'.")
        return filtered_rewards

    greedy_rewards_plot = filter_block_outliers_for_plot(greedy_rewards, "Greedy")
    fcfs_rewards_plot = filter_block_outliers_for_plot(fcfs_rewards, "FCFS")
    mined_rewards_plot = filter_block_outliers_for_plot(mined_rewards, "Mined")
    
    fig, axes = plt.subplots(3, 1, figsize=(15, 18), sharex=True)
    fig.suptitle(f'Ganancia por Bloque - {titulo_escenario} (Sin Outliers en Gráfico)', fontsize=16)

    axes[0].plot(greedy_rewards_plot.index, greedy_rewards_plot.values, label='Greedy', color='blue')
    axes[0].set_title('Algoritmo Greedy'); axes[0].set_ylabel('Ganancia (ETH)'); axes[0].grid(True); axes[0].legend()

    axes[1].plot(fcfs_rewards_plot.index, fcfs_rewards_plot.values, label='FCFS', color='orange')
    axes[1].set_title('Algoritmo FCFS'); axes[1].set_ylabel('Ganancia (ETH)'); axes[1].grid(True); axes[1].legend()

    if not mined_rewards_plot.empty:
        axes[2].plot(mined_rewards_plot.index, mined_rewards_plot.values, label='Mined (Real)', color='gray')
    axes[2].set_title('Red Real (Mined)'); axes[2].set_xlabel('Número de Bloque'); axes[2].set_ylabel('Ganancia (ETH)'); axes[2].grid(True); axes[2].legend()

    plt.tight_layout(rect=[0, 0.03, 1, 0.96]); plt.show()
    print("Gráfico generado.\n")

    # --- Métricas Generales y por Bloque ---
    print("--- Métricas Generales ---")
    for name, df in datasets.items():
        if df.empty:
            print(f"\n--- {name}: Sin datos para analizar. ---")
            continue

        print(f"\n--- {name} ---")
        
        # 1.0) Porcentaje de Tipos de Transacción
        tx_type_counts = df['TransactionType'].value_counts(normalize=True).sort_index()
        print("1.0) Distribución de Tipos de Transacción:")
        for tx_type, percentage in tx_type_counts.items():
            print(f"     - Tipo {int(tx_type)}: {percentage:.2%}")

        # 1.1) Ganancias totales y cantidad de bloques
        total_ganancia = df['BlockReward(ETH)'].sum()
        cantidad_bloques = df['BlockNumber'].nunique()
        print(f"1.1) Ganancia Total: {total_ganancia:,.6f} ETH")
        print(f"1.1) Cantidad de Bloques: {cantidad_bloques}")

        # 1.3) Sumatoria de BaseFee
        if name == 'Mined' and 'GasUsed' in df.columns and df['GasUsed'].sum() > 0:
            df['TotalBaseFeeCost_ETH'] = df['BaseFee(ETH)'] * df['GasUsed']
            total_quemado_eth = df['TotalBaseFeeCost_ETH'].sum()
            print(f"1.3) Total Quemado (BaseFee): {total_quemado_eth:,.6f} ETH")
        
        # 1.4) Ganancia por bloque y frecuencia
        ganancia_promedio_bloque = total_ganancia / cantidad_bloques if cantidad_bloques > 0 else 0
        print(f"1.4) Ganancia promedio por bloque: {ganancia_promedio_bloque:,.8f} ETH")
        
        if 'TimeStamp' in df.columns and not df['TimeStamp'].isnull().all():
            total_duration_seconds = (df['TimeStamp'].max() - df['TimeStamp'].min()).total_seconds()
            if total_duration_seconds > 0:
                frecuencia_bloques = cantidad_bloques / total_duration_seconds
                print(f"1.4) Frecuencia de bloques: {frecuencia_bloques:.4f} bloques/segundo ({1/frecuencia_bloques:.2f} seg/bloque)")

        # 1.5) Ocupancia promedio por bloque
        block_gas_series = df[df['BlockGas'] > 0]['BlockGas']
        ocupancia_promedio = block_gas_series.mean() if not block_gas_series.empty else 0
        print(f"1.5) Ocupancia promedio por bloque: {ocupancia_promedio:,.0f} Gas")

        # Métrica Adicional: Eficiencia de Ganancia
        total_gas = df[df['BlockGas'] > 0]['BlockGas'].sum()
        if total_gas > 0:
            eficiencia_ganancia = (total_ganancia * 1e9) / total_gas # Gwei por Gas
            print(f"*) Eficiencia de Ganancia: {eficiencia_ganancia:,.2f} Gwei/Gas")

        # 1.2) Top 5 Transacciones
        print("\n1.2) Top 5 Transacciones Más Valiosas:")
        print(df.nlargest(5, 'GananciaxTransaccion(ETH)')[['TransactionHash', 'GananciaxTransaccion(ETH)']].to_string(index=False, float_format="%.8f"))
        
        # 1.6) Top 5 Bloques
        print("\n1.6) Top 5 Bloques Más Valiosos:")
        print(df.groupby('BlockNumber')['BlockReward(ETH)'].sum().nlargest(5).to_string())

    # --- 2. Análisis Comparativo ---
    print("\n\n--- 2. Análisis Comparativo (vs Mined) ---")
    if not df_mined.empty:
        set_mined_total = set(df_mined['TransactionHash'])
        for name, df_algo in [('Greedy', df_greedy), ('FCFS', df_fcfs)]:
            if not df_algo.empty:
                # 2) Coincidencias
                set_algo = set(df_algo['TransactionHash'])
                coincidencias = len(set_algo.intersection(set_mined_total))
                print(f"2) Coincidencias {name} vs Mined: {coincidencias} de {len(set_mined_total)} ({coincidencias/len(set_mined_total):.2%})")
        
        # 2.1) Latencia FCFS
        if not df_fcfs.empty:
            merged_df = pd.merge(
                df_fcfs[['TransactionHash', 'BlockNumber']].rename(columns={'BlockNumber': 'BlockNumber_fcfs'}),
                df_mined[['TransactionHash', 'NormalizedBlockNumber']].rename(columns={'NormalizedBlockNumber': 'BlockNumber_mined'}),
                on='TransactionHash'
            )
            if not merged_df.empty:
                merged_df['LatenciaEnBloques'] = merged_df['BlockNumber_mined'] - merged_df['BlockNumber_fcfs']
                print(f"2.1) Latencia promedio (FCFS vs Mined): {merged_df['LatenciaEnBloques'].mean():.2f} bloques")

    print("\n" + "="*80); print(f"FIN DEL ANÁLISIS: {titulo_escenario.upper()}"); print("="*80 + "\n")

# %%
# =================================================================
# 4. EJECUCIÓN DE LOS ANÁLISIS
# =================================================================
if __name__ == '__main__':
    df_greedy_orig = load_and_clean_csv(GREEDY_CSV)
    df_fcfs_orig = load_and_clean_csv(FCFS_CSV)
    df_mined_orig = load_and_clean_csv(MINED_CSV)

    if all(df is not None for df in [df_greedy_orig, df_fcfs_orig, df_mined_orig]):
        analizar_escenario(df_greedy_orig.copy(), df_fcfs_orig.copy(), df_mined_orig.copy(), "Análisis Completo")
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
