## Frag
File Reaper AGgregator: aggregation de fichiers pour différents drivers:
 - `fs`: aggregation de fichiers depuis le système de fichiers de la machine
 - `s3`: aggregation de fichiers depuis une API S3

### Usage
```
 frag: File Reaper AGgregator: aggregates files into size-controlled chunks

   USAGE:
     -c, --chunk:         The maximum size of the chunks (eg: 1000, 1kb, 2MB)
     --crlf:              Use CRLF to concatenate chunks (default: LF)
     -d, --driver:        Driver to use to read/write files (default: 'fs', available: 'fs', 's3')
     --delete-src:        If true, the source files will be deleted (transactional)
     -h, --help:          Shows this help message
     --no-strict-size:    If enabled, chunk size can be less than the value specified by -c
     -o, --output:        File to write the results (JSON)
     --keep-prefixes:     Create chunks based on there directory prefixes (default: 0)
     -s, --src:           The source used to read files from (fs: directory, s3: bucket)
     -t, --dst:           The destination used to write chunks to (fs: directory, s3: bucket)
     -v, --version:       Display the current version of frag
```

### Example d'utilisation
Voir le dossier de [tests](test/)

### Documentation


> `frag` utilise `dotenv` par defaut, se qui implique qu'il chargera les variables d'environment défini dans un fichier `.env` à côté du script de lancement, s'il existe.

> Tous les paramètres du CLI `frag` peuvent être défini à l'aide de variable d'environment via la convention de nommage suivante:
> `DELETE_SRC=true` est équivalent à `--delete-src`
> 
> Une exception existe pour la définition du driver `-d` qui elle est obligatoire en paramètre de ligne de commande

#### `-s, --src`
La source des fichiers à aggréger. Typiquement un dossier ou un bucket (s3)

#### `-d, --dst`
L'emplacement de destination des fichiers aggrégée à écrire. Typiquement un dossier ou un bucket (s3)

#### `-c, --chunk`
La taille maximum des aggrégats. Définissable avec une écriture pseudo-naturelle (cf. [bytes](https://github.com/visionmedia/bytes.js#readme))

Lors de l'aggrégation des fichiers sources, `frag` limitera à cette taille les fichiers produits.

#### `--crlf`
Par défaut, `frag` utilise le caractère `\n` (Line-Feed, LF) pour aggréger le contenu des fichiers sources.  
En utilisant ce paramètre, `frag` utilisera les caractères `\r\n` (Carriage-Return Line-Feed, CRLF).

> Note: les retours chariots à l'intérieur même des fichiers sources ne seront pas modifiés. Seulement les "jointures" entre fichier.

#### `--delete-src`
Par defaut, `frag` ne supprime pas les fichiers sources utilisés pour les aggrégats.  
En définissant ce paramètre à `true`, les fichiers sources utilisés pour créer les aggrégats seront supprimés une fois l'écriture de l'aggrégat confirmé.

#### `--no-strict-size`
Par defaut, `frag` n'écrit pas les aggrégats dans le dossier destination si la taille de l'aggrégat est inférieur à la taille spécifiée par `-c`.  
Si ce paramètre est `true`, alors l'écriture des aggrégats se fera, même si leur taille est inférieur à `-c`

#### `-o, --output`
Par défaut, `frag` log sur la sortie standard un objet de résultat des actions prises.  
En utilisant ce paramètre, `frag` peut écrire ces résultats directement au format json à l'emplacement indiqué.

#### `--keep-prefixes`
Par défaut, `frag` ne se soucie pas des préfixes des fichiers trouvés à l'emplacement source. Il aggrègera tous les fichiers présent dans la source et les écrira à l'emplacement de destination.

En utilisant ce paramètre, `frag` peut répercuter le préfix source à l'emplacement de destination.

Ex:
`frag -d fs -s sources -d destination --keep-prefixes 1`

```
├── destination
│   ├── prefix-a
│   │   └── 6f5902ac237024bdd0c176cb93063dc4.csv.gz
│   └── prefix-b
│       └── b1413e98b3dc999d32374dab885f309a.json.gz
└── sources
    ├── prefix-a
    │   ├── file-0.csv
    │   ├── file-1.csv
    │   └── file-2.csv
    └── prefix-b
        ├── file-0.json
        ├── file-1.json
        ├── file-2.json
        └── file-3.json
```