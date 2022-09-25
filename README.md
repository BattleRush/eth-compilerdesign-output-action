# ETH Compiler Design Tests Output Formatter

This action parses the output of the make test command and formats it as a GitHub Action markdown.

## Inputs

## `make-output`

**Required** The value of the make test command.

## Outputs

## `markdown`

The formatted markdown to use in the GitHub Action.

## Example usage

# Define your make step as follows
- name: Run make
    id: maketest
    run: |
        eval $(opam env)
        make >> $MakeOutput

# Then use the output formatter
- name: Create GitHub Action markdown
    uses: BatteRush/eth-compilerdesign-output-action@v0.0.1
    with:
        make-output: '{{ steps.maketest.outputs.MakeOutput }}'