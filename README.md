# MempoolAnalyser
Repositorio para automatizar proceso de recoleccion de transacciones, test de algoritmos y comparación de resultados. <br>
# Procedimiento general
## Paso 0: Configurar nodo de forma local 
En este caso se entregarán los comandos necesarios para inicializar un nodo completo en Sepolia en MacOS usando Nimbus para el cliente de consenso y Geth para el de ejecución.
Comando Geth:
```bash
sudo geth \
--sepolia \
--http \
--http.api eth,net,engine,web3 \
--ws \
--ws.api eth,net,engine,web3 \
--authrpc.jwtsecret /tmp/jwtsecret \
--syncmode snap \
--gcmode archive \
--cache 16384 \
--maxpeers 1000
```
Comando Nimbus para sincronizar desde un nodo de confianza(ahorro de tiempo):
```bash
build/nimbus_beacon_node trustedNodeSync \
  --network:sepolia \
  --data-dir=build/data/shared_sepolia_0 \
  --trusted-node-url=https://checkpoint-sync.sepolia.ethpandaops.io
```
Comando Nimbus para inicializar cliente de consenso:
```bash
sudo build/nimbus_beacon_node \
    --network=sepolia \
    --data-dir=build/data/shared_sepolia_0 \
    --web3-url=http://127.0.0.1:8551 \
    --jwt-secret=/tmp/jwtsecret
```
Comando para verificar si el nodo está sincronizado:
```bash
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' http://localhost:8545
```
Si está sincronizado devuelve la respuesta:
```JSON
{"jsonrpc":"2.0","id":1,"result":false}
```

De lo contrario devolverá una respuesta mas larga indicando el progreso de la sincronización, como por ejemplo:
```JSON
{"jsonrpc":"2.0","id":1,"result":{"currentBlock":"0x0","healedBytecodeBytes":"0x0","healedBytecodes":"0x0","healedTrienodeBytes":"0x0","healedTrienodes":"0x0","healingBytecode":"0x0","healingTrienodes":"0x0","highestBlock":"0x0","startingBlock":"0x0","syncedAccountBytes":"0x0","syncedAccounts":"0x0","syncedBytecodeBytes":"0x0","syncedBytecodes":"0x0","syncedStorage":"0x0","syncedStorageBytes":"0x0","txIndexFinishedBlocks":"0x0","txIndexRemainingBlocks":"0x1"}}
```

## Paso 1: Recolectar las siguientes columnas de información de la mempool:
TransactionHash,TransactionType,GasLimit,MaxPriorityFee,GananciaxTransaccion,TimeStamp,NetworkBlock,PeerCount <br> 
Todo aquello relacionado a ganancias va a estar por defecto en Wei, pero es mejor idea convertirlo todo a Gwei desde el momento que llega así se evitan errores de int muy grandes luego. <br>
Se escribe cada un minuto en el csv así se evita overflow en la memoria HEAP.<br>

## Paso 2: Programar y usar algoritmos greedy y fcfs y que el csv output tenga las siguientes columnas:
TransactionHash,TransactionType,GasLimit,MaxPriorityFee,GananciaxTransaccion,TimeStamp,BlockNumber,BlockReward,BlockGas <br>

-BlockReward sea la sumatoria de las ganancias de cada transaccion, GananciaxTransaccion y BlockReward se colocan en Gwei. BlockReward y
BlockGas solo aparecen en la fila de la ultima transaccion del bloque.<br>

-El algoritmo greedy utiliza MaxHeap para ordenar las transacciones a medida que las va parseando del csv, y se realiza una división entre MaxPriorityFee y GasLimit, dónde los valores más altos son aquellos deseados.<br>

-El algoritmo fcfs va incluyendo en los bloques transacciones dependiendo de su orden de llegada, imitando lo que hace la red Sepolia.<br>

## Paso2.1: Los algoritmos tienen las siguientes características:

-Una vez que una transaccion es incluida en un bloque, deja de ser considerada para
bloques futuros.<br>

-Si una transaccion no es incluida en un bloque, puede ser considerada para bloques
futuros hasta que sea incorporada en uno, después de eso deja de ser considerada.<br>

-Solo se pueden ver t segundos adelante en cada bloque(por ejemplo si la primera
transaccion ocurre en t=20, el bloque se arma unicamente con transacciones
t<=32), imitando el comportamiento de la red real.<br>

-Existe una lista, donde se almacenan todas las transacciones que cumplan el requisito de la ventana de tiempo, y si son incluidas por el
algoritmo que se eliminen de la lista. Así las que no son incorporadas en un bloque son
consideradas en un bloque futuro hasta que sean incluidas.<br>

-Se incorpora característica real red Ethereum: Todos los bloques tienen un target de 15
millones de gas, pero en casos donde se encuentre cerca del target y la transacción
siguiente a incorporarse lo superaría, se incluye igualmente y se cierra el bloque con esa
transacción. Igualmente existe un hard cap de 30 millones.<br>

-Una vez construidos ambos csv, se realiza un test de una sumatoria de la columna BlockReward y
se revisa que ambos den el mismo resultado, ya que a través de la lógica incorporada
deberían ser equivalentes.<br>

## Paso 3: Conseguir datos de red real que vayan desde NetworkBlock0 hasta NetworkBlock i-1, y que contenga las siguientes columnas:
TransactionHash,TransactionType,GasUsed,MaxPriorityFee,GananciaxTransaccion(post
BaseFee),BaseFee,BlockNumber,BlockGas,BlockReward(como sumatoria de las
transacciones contenidas en un bloque, no como el block reward que aparece en
EtherScans). <br>

El valor de BlockReward y BlockGas aparecen solamente en la fila de la
ultima transaccion de cada bloque. Al igual que en los algoritmos, se hace la conversión de Wei a Gwei para las casillas de BlockReward y GananciaxTransaccion

## Paso4: A través de pandas en python, analizar los siguientes datos de los 3 csv:

1)Hacer un grafico donde el eje x sea el numero de bloque y el eje y la ganancia, así se
puede ver si el fcfs sigue a la red. Puede ser conveniente normalizar el numero de bloque
ya que en los algoritmos parte desde el 1 mientras que en mined parte desde el numero de
bloque real. 
Normalizar el BlockNumber ya que mined tiene el BlockNumber de la red real y no como el de los algoritmos que parte desde 1.<br>

1.1)Colocar ganancias totales de cada csv(sumatoria BlockReward) y la cantidad de
bloques que existieron.<br>

1.2)Colocar las 5 transacciones más valiosas de cada csv(respecto a
GananciaxTransaccion).<br>

1.3)Hacer la sumatoria de las BaseFee para ver del total cuanto fue disminuido por ello.<br>

1.4)Calcular ganancia por bloque y frecuencia de bloque para ver si cumple con el estándar de ethereum de un bloque cada 12 segundos. Esto se verifica con el tiempo total(usando el ultimo y el primer TimeStamp)<br>

1.5) Ocupancia promedio por bloque en gas.<br>

1.6) Top 5 bloques más valiosos por csv.<br>

2)Analizar cantidad de coincidencias de transacciones entre cada algoritmo y el de mined
a traves del TransactionHash.<br>

2.1)Colocar la latencia para transacciones coincidentes respecto al numero de bloque de
fcfs y Sepolia. <br>

3)Realizar este mismo análisis dos veces más, quitando todas las transacciones tipo 2 y
otro con solo las transacciones tipo 2.
https://docs.chainstack.com/docs/ethereum-how-to-analyze-pending-blocks
https://www.quicknode.com/guides/ethereum-development/transactions/how-to-access-ethereum-mempool#:~:text=For%20example%2C%20the%20default%20settings,and%20depend%20on%20their%20settings.
https://docs.flashbots.net/flashbots-mev-boost/block-builders
