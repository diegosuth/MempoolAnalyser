/**
 * =================================================================
 * Archivo: greedy_persistent.js
 * Descripción: Versión mejorada del algoritmo Greedy que NO descarta
 * transacciones. Las transacciones no incluidas se mantienen en el pool
 * para ser consideradas en bloques futuros.
 *
 * EJECUCIÓN: node greedysepoliav6.js
 * =================================================================
 */

// --- Dependencias ---
import fs from 'fs';
import { parse } from 'csv-parse';
import { createObjectCsvWriter } from 'csv-writer';

// =================================================================
// --- CONFIGURACIÓN ---
// =================================================================

const INPUT_CSV_PATH = './mempool_data_sepolia.csv';
// CORRECCIÓN: Nombre de archivo de salida estandarizado
const OUTPUT_CSV_PATH = './greedy_results_fixed.csv';

const BLOCK_INTERVAL_SECONDS = 12;
const GAS_TARGET = 30000000n;
const GAS_HARD_CAP = 60000000n;
const MAX_EXTRA_BLOCKS = 100; // Aumentado para permitir más bloques extra

// =================================================================
// --- CLASE MAX-HEAP ---
// =================================================================
class MaxHeap {
    constructor() { this.heap = []; }
    getParentIndex(i) { return Math.floor((i - 1) / 2); }
    getLeftChildIndex(i) { return 2 * i + 1; }
    getRightChildIndex(i) { return 2 * i + 2; }
    hasParent(i) { return this.getParentIndex(i) >= 0; }
    hasLeftChild(i) { return this.getLeftChildIndex(i) < this.heap.length; }
    hasRightChild(i) { return this.getRightChildIndex(i) < this.heap.length; }
    swap(i1, i2) { [this.heap[i1], this.heap[i2]] = [this.heap[i2], this.heap[i1]]; }
    peek() { return this.heap.length > 0 ? this.heap[0] : null; }
    add(item) { this.heap.push(item); this.heapifyUp(); }
    poll() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();
        const item = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.heapifyDown();
        return item;
    }
    heapifyUp() {
        let index = this.heap.length - 1;
        while (this.hasParent(index) && this.heap[this.getParentIndex(index)].ratio < this.heap[index].ratio) {
            const parentIndex = this.getParentIndex(index);
            this.swap(parentIndex, index);
            index = parentIndex;
        }
    }
    heapifyDown() {
        let index = 0;
        while (this.hasLeftChild(index)) {
            let largerChildIndex = this.getLeftChildIndex(index);
            if (this.hasRightChild(index) && this.heap[this.getRightChildIndex(index)].ratio > this.heap[this.getLeftChildIndex(index)].ratio) {
                largerChildIndex = this.getRightChildIndex(index);
            }
            if (this.heap[index].ratio > this.heap[largerChildIndex].ratio) {
                break;
            } else {
                this.swap(index, largerChildIndex);
            }
            index = largerChildIndex;
        }
    }
    size() { return this.heap.length; }
}

// =================================================================
// --- LÓGICA DEL ALGORITMO GREEDY (CON PERSISTENCIA) ---
// =================================================================
function buildBlocksGreedy(transactions) {
    console.log("-> Ejecutando Algoritmo Greedy (Versión con Persistencia)...");

    const cleanTxs = transactions.map(tx => {
        try {
            const gasLimit = BigInt(tx.GasLimit);
            const maxPriorityFee = BigInt(tx.MaxPriorityFee);
            const ganancia = BigInt(tx.GananciaxTransaccion);
            const timeStamp = Date.parse(tx.TimeStamp);

            if (isNaN(timeStamp) || gasLimit === 0n || gasLimit > GAS_HARD_CAP) return null;

            return {
                ...tx,
                gasLimitNum: gasLimit,
                maxPriorityFeeNum: maxPriorityFee,
                gananciaNum: ganancia,
                timeStampNum: Math.floor(timeStamp / 1000),
                ratio: parseFloat(maxPriorityFee.toString()) / parseFloat(gasLimit.toString()),
            };
        } catch (e) { return null; }
    }).filter(tx => tx !== null);

    if (cleanTxs.length === 0) {
        console.log("Error Crítico: Ninguna transacción fue válida después de la limpieza.");
        return [];
    }
    
    let availableTxs = cleanTxs.sort((a, b) => a.timeStampNum - b.timeStampNum);
    const finalBuiltTxs = [];
    let blockNumber = 1;
    let blockStartTime = availableTxs[0].timeStampNum;

    while (availableTxs.length > 0 && blockStartTime <= availableTxs[availableTxs.length - 1].timeStampNum) {
        const candidates = availableTxs.filter(tx => tx.timeStampNum <= blockStartTime + BLOCK_INTERVAL_SECONDS);
        if (candidates.length > 0) {
            const txHeap = new MaxHeap();
            candidates.forEach(tx => txHeap.add(tx));
            let currentBlockTxs = [];
            let currentBlockGas = 0n;
            let blockRewardWei = 0n;
            const includedInThisBlock = new Set();

            while (txHeap.size() > 0) {
                const bestTx = txHeap.poll();
                if (currentBlockGas + bestTx.gasLimitNum <= GAS_HARD_CAP) {
                    currentBlockTxs.push(bestTx);
                    currentBlockGas += bestTx.gasLimitNum;
                    blockRewardWei += bestTx.gananciaNum;
                    includedInThisBlock.add(bestTx.TransactionHash);
                    if (currentBlockGas >= GAS_TARGET) break;
                }
            }

            if (currentBlockTxs.length > 0) {
                console.log(`-> Bloque #${blockNumber} construido con ${currentBlockTxs.length} transacciones. Gas usado: ${currentBlockGas.toString()}`);
                currentBlockTxs.forEach((tx, index) => {
                    tx.BlockNumber = blockNumber;
                    if (index === currentBlockTxs.length - 1) {
                        tx.BlockReward = blockRewardWei.toString();
                        tx.BlockGas = currentBlockGas.toString();
                    } else {
                        tx.BlockReward = '';
                        tx.BlockGas = '';
                    }
                });
                finalBuiltTxs.push(...currentBlockTxs);
                blockNumber++;
                availableTxs = availableTxs.filter(tx => !includedInThisBlock.has(tx.TransactionHash));
            }
        }
        blockStartTime += BLOCK_INTERVAL_SECONDS;
    }

    console.log(`\n--- Fin de la simulación de tiempo. ${availableTxs.length} transacciones restantes. ---`);
    console.log("--- Iniciando fase de construcción de bloques extra... ---");
    let extraBlocksBuilt = 0;
    while (availableTxs.length > 0 && extraBlocksBuilt < MAX_EXTRA_BLOCKS) {
        const txHeap = new MaxHeap();
        availableTxs.forEach(tx => txHeap.add(tx));
        let currentBlockTxs = [];
        let currentBlockGas = 0n;
        let blockRewardWei = 0n;
        const includedInThisBlock = new Set();
        
        while (txHeap.size() > 0) {
            const bestTx = txHeap.poll();
            if (currentBlockGas + bestTx.gasLimitNum <= GAS_HARD_CAP) {
                currentBlockTxs.push(bestTx);
                currentBlockGas += bestTx.gasLimitNum;
                blockRewardWei += bestTx.gananciaNum;
                includedInThisBlock.add(bestTx.TransactionHash);
                if (currentBlockGas >= GAS_TARGET) break;
            }
        }

        if (currentBlockTxs.length > 0) {
            extraBlocksBuilt++;
            console.log(`-> Bloque Extra #${blockNumber} construido con ${currentBlockTxs.length} transacciones.`);
            currentBlockTxs.forEach((tx, index) => {
                tx.BlockNumber = blockNumber;
                if (index === currentBlockTxs.length - 1) {
                    tx.BlockReward = blockRewardWei.toString();
                    tx.BlockGas = currentBlockGas.toString();
                } else {
                    tx.BlockReward = '';
                    tx.BlockGas = '';
                }
            });
            finalBuiltTxs.push(...currentBlockTxs);
            blockNumber++;
            availableTxs = availableTxs.filter(tx => !includedInThisBlock.has(tx.TransactionHash));
        } else {
            console.log(`No se pueden construir más bloques. ${availableTxs.length} transacciones finales descartadas.`);
            break;
        }
    }
    return finalBuiltTxs;
}

async function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const records = [];
        fs.createReadStream(filePath)
            .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
            .on('data', (row) => records.push(row))
            .on('end', () => resolve(records))
            .on('error', (error) => reject(error));
    });
}

async function writeCsv(filePath, data) {
    if (!data || data.length === 0) {
        console.warn(`No hay datos para escribir en ${filePath}.`);
        return;
    }
    const formattedData = data.map(tx => ({
        TransactionHash: tx.TransactionHash,
        TransactionType: tx.TransactionType,
        GasLimit: tx.GasLimit,
        MaxPriorityFee: tx.MaxPriorityFee,
        GananciaxTransaccion: tx.GananciaxTransaccion,
        TimeStamp: tx.TimeStamp,
        BlockNumber: tx.BlockNumber,
        BlockReward: tx.BlockReward,
        BlockGas: tx.BlockGas,
    }));
    const headers = Object.keys(formattedData[0]).map(key => ({ id: key, title: key }));
    const csvWriter = createObjectCsvWriter({ path: filePath, header: headers });
    await csvWriter.writeRecords(formattedData);
}

async function main() {
    console.log('Iniciando el procesador Greedy (versión con persistencia)...');
    try {
        const transactions = await readCsv(INPUT_CSV_PATH);
        if (transactions.length === 0) {
            console.log("El archivo de entrada está vacío.");
            return;
        }
        console.log(`-> Se leyeron ${transactions.length} transacciones de ${INPUT_CSV_PATH}.`);
        const greedyResults = buildBlocksGreedy(transactions);
        if (greedyResults.length > 0) {
            const totalBlocks = greedyResults.reduce((max, tx) => Math.max(max, tx.BlockNumber || 0), 0);
            console.log(`\n-> Algoritmo finalizado. Se construyeron ${totalBlocks} bloques con ${greedyResults.length} transacciones.`);
        } else {
            console.log("\n-> Algoritmo finalizado. No se pudo construir ningún bloque.");
        }
        await writeCsv(OUTPUT_CSV_PATH, greedyResults);
        console.log(`\n¡Proceso completado! Resultados guardados en: ${OUTPUT_CSV_PATH}`);
    } catch (error) {
        console.error("\nOcurrió un error:", error.message);
        console.error(error.stack);
    }
}

main();
