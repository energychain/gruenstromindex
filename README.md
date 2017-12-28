# Grünstromindex
Grünstrom Index zur Behandlung von Netzdienlichkeit und Berechnung dynamischer/variabler Stromtarife


## Installation
```
npm install -g gruenstromindex
```

## Nutzung
```
stromdao-gsi help
 Commands:

    help [command...]                   Provides help for a given command.
    exit                                Exits application.
    signer                              Prints current Message Signer
    sign <value>                        Signs a given Value
    verify [options]                    Verify
    gsi [options]                       Get Green Power Index (Germany)
    webuser [options] <meter_point_id>  Create a new webuser (or overwrite) with given credentials
    backup <zipfilename>                Exports local storage to zip file.
```

## Beispiele
Ermitteln eines Strompreises für die kommenden Stunden mit einem Bonus von 5 Cent in 69256 Mauer.
```
stromdao-gsi gsi -p 69256 -s -n 5000000
```


