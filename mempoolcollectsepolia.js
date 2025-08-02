import { ethers } from 'ethers';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';

// --- Configuración ---
const NODE_WSS_URL = 'ws://localhost:8546';
const FLUSH_INTERVAL = 60000;
const CSV_FILE_PATH = './mempool_data_sepolia.csv';
const RUN_DURATION = 3600000 * 12; // 12 horas. null para ejecución infinita.
// --- Fin de la Configuración ---

let transactionBuffer = [];

const csvHeader = [
    { id: 'TransactionHash', title: 'TransactionHash' },
    { id: 'TransactionType', title: 'TransactionType' },
    { id: 'GasLimit', title: 'GasLimit' },
    { id: 'MaxPriorityFee', title: 'MaxPriorityFee' },
    { id: 'GananciaxTransaccion', title: 'GananciaxTransaccion' },
    { id: 'TimeStamp', title: 'TimeStamp' },
    { id: 'NetworkBlock', title: 'NetworkBlock' },
    { id: 'PeerCount', title: 'PeerCount' },
];

const initializeCsvFile = () => {
    if (!fs.existsSync(CSV_FILE_PATH)) {
        createObjectCsvWriter({
            path: CSV_FILE_PATH,
            header: csvHeader
        }).writeRecords([])
          .then(() => console.log(`Archivo CSV creado en: ${CSV_FILE_PATH}`));
    }
};

const flushToCsv = async (csvWriter) => {
    if (transactionBuffer.length === 0) {
        console.log('No hay nuevas transacciones para escribir. Esperando...');
        return;
    }

    const transactionsToWrite = [...transactionBuffer];
    transactionBuffer = [];

    try {
        await csvWriter.writeRecords(transactionsToWrite);
        console.log(`Éxito: Se escribieron ${transactionsToWrite.length} transacciones en ${CSV_FILE_PATH}`);
    } catch (error) {
        console.error('Error al escribir en el archivo CSV:', error);
    }
};

/**
 * Función principal que configura los listeners e inicia el proceso.
 */
const main = async () => {
    let provider; // Declarar provider aquí
    let flushInterval;

    try {
        // --- CORRECCIÓN CLAVE ---
        // La inicialización del provider se mueve DENTRO del bloque try.
        console.log(`Intentando conectar a: ${NODE_WSS_URL}...`);
        provider = new ethers.WebSocketProvider(NODE_WSS_URL);

        // Verificar la conexión con el nodo.
        const network = await provider.getNetwork();
        console.log(`Conectado exitosamente a la red: ${network.name} (Chain ID: ${network.chainId})`);
        
        initializeCsvFile();

        const csvWriter = createObjectCsvWriter({
            path: CSV_FILE_PATH,
            header: csvHeader,
            append: true,
        });

        console.log('Escuchando transacciones pendientes de la mempool...');
        
        provider.on('pending', async (txHash) => {
            try {
                const [tx, peerCountHex] = await Promise.all([
                    provider.getTransaction(txHash),
                    provider.send('net_peerCount', [])
                ]);

                if (!tx) return;

                const peerCount = parseInt(peerCountHex, 16);
                const currentBlockNumber = await provider.getBlockNumber();
                const maxPriorityFee = tx.maxPriorityFeePerGas || 0n;
                const ganancia = tx.gasLimit * maxPriorityFee;

                const transactionData = {
                    TransactionHash: tx.hash,
                    TransactionType: tx.type,
                    GasLimit: tx.gasLimit.toString(),
                    MaxPriorityFee: maxPriorityFee.toString(),
                    GananciaxTransaccion: ganancia.toString(),
                    TimeStamp: new Date().toISOString(),
                    NetworkBlock: currentBlockNumber,
                    PeerCount: peerCount,
                };
                transactionBuffer.push(transactionData);
            } catch (error) {
                if (error.code !== 'REPLACEMENT_UNDERPRICED' && error.code !== 'NONCE_EXPIRED') {
                    console.warn(`Advertencia: No se pudo procesar la transacción ${txHash}: ${error.message}`);
                }
            }
        });

        flushInterval = setInterval(() => flushToCsv(csvWriter), FLUSH_INTERVAL);

        provider.on('error', (error) => {
            console.error('Error del proveedor WebSocket:', error);
            // En un script de producción, aquí podrías intentar reconectar.
            process.exit(1);
        });

        if (RUN_DURATION) {
            console.log(`El script se ejecutará durante ${RUN_DURATION / 1000 / 60 / 60} horas y luego se detendrá.`);
            setTimeout(async () => {
                console.log('Tiempo de ejecución alcanzado. Finalizando el script...');
                clearInterval(flushInterval);
                provider.off('pending');
                await flushToCsv(csvWriter);
                provider.destroy();
                console.log('El script ha finalizado y todos los datos han sido guardados.');
                process.exit(0);
            }, RUN_DURATION);
        }

    } catch (error) {
        // Si la conexión inicial falla, este bloque lo capturará.
        console.error('FALLO CRÍTICO AL INICIAR: No se pudo conectar al nodo de ejecución.');
        console.error('Detalles del error:', error.message);
        console.error('Por favor, asegúrate de que Geth esté corriendo y que la URL del WebSocket sea correcta.');
        if (provider) provider.destroy();
        process.exit(1);
    }
};

// Ejecutar la función principal.
main();