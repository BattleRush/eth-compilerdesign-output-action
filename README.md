# ETH Compiler Design Tests Output Formatter

This action parses the output of the make test command and formats it as a GitHub Action markdown.

![image](https://user-images.githubusercontent.com/11750584/192163257-d0357bde-e228-4eb1-acfb-e21c6aeb6a95.png)


## Inputs

`make-output`
**Required** The path to the output of the make command

## Outputs

`markdown`

The formatted markdown to use in the GitHub Action.

## Example usage

```yml
# Define your make step as follows
- name: Run make
    id: maketest
    run: |
        eval $(opam env)
        make > make.out

# Then use the output formatter
- name: Create GitHub Action markdown
    uses: BatteRush/eth-compilerdesign-output-action@v0.0.1
    with:
        make-output: make.out
```

# SETUP

## Makefile
Put a new Makefile in the root of your Compiler Design project with the following content

```makefile
# Get all root folders to run the make in except the _build and llvm dirrectory
SUBDIRS := $(wildcard */.)
SUBDIRS := $(filter-out _build/.,$(SUBDIRS))
SUBDIRS := $(filter-out llvm/.,$(SUBDIRS))

MAKE := make test

all: $(SUBDIRS)
$(SUBDIRS):
	$(MAKE) -C $@;\

.PHONY: all $(SUBDIRS)
```

# Example makefile.yml
You can put this in the root folder (.github/workflows) of the project which will then be used to run the action on each push

```yml
name: Run Tests

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build:
    # One can also use ubuntu-18.04 however this is getting depricated by Jan 2023
    runs-on: ubuntu-20.04 #ubuntu-latest for 22.04 (22.04 wont work with LLVM 9 however)

    steps:
    - name: checkout repo
      uses: actions/checkout@v3
      
    - name: Cache Opam
      id: cache-ocaml
      uses: actions/cache@v3
      with:
        path: /home/runner/.opam
        key: ${{ runner.os }}-opam

    - name: Cache LLVM
      id: cache-llvm
      uses: actions/cache@v3
      with:
        path: ./llvm
        key: llvm-9
        
    - name: Install LLVM and Clang
      uses: KyleMayes/install-llvm-action@v1
      with:
        version: "9.0"
        cached: ${{ steps.cache-llvm.outputs.cache-hit }}

    - name: Set up OCaml
      uses: ocaml/setup-ocaml@v1.1.11
      with:
        ocaml-version: 4.06.0

    # Change to opam environment after 4.06.0 switch and install needed packages
    - run: eval $(opam env)
    - run: opam install ocamlbuild
    - run: opam install menhir
    - run: opam install num 

    - name: Run make
      id: maketest
      run: |
        eval $(opam env)
        make > make.out
        
    - name: Create GitHub Action markdown
      id: outputparser
      uses: BattleRush/eth-compilerdesign-output-action@main
      with:
          make-output: make.out
          
    - name: Get the output markdown
      run: echo "${{ steps.outputparser.outputs.markdown }}" >> $GITHUB_STEP_SUMMARY
```


# Example output 

![image](https://user-images.githubusercontent.com/11750584/192164630-81c79b99-e0b1-4829-a712-9c1bd750a3a6.png)
