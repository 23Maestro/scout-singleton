# NVM Configuration - Load NVM first
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Set Node.js v22.16.0 as default and use it
nvm alias default 22.16.0
nvm use 22.16.0

# Oh My Zsh Configuration
export ZSH="$HOME/.oh-my-zsh"
export ZSH_CUSTOM="$ZSH/custom"
export ZSH_CACHE_DIR="$ZSH/cache"

# Load Oh My Zsh
source $ZSH/oh-my-zsh.sh

# Additional PATH configurations (after NVM)
fpath+=($(brew --prefix)/share/zsh/site-functions)

# LM Studio CLI
export PATH="$PATH:/Users/singleton23/.lmstudio/bin"

# Local environment
. "$HOME/.local/bin/env"

# Docker CLI completions
fpath=(/Users/singleton23/.docker/completions $fpath)
autoload -Uz compinit
compinit

# Raycast templates
source /Users/singleton23/Raycast/.templates/snippets/common.zsh

# Environment variables
export CLAUDE_CODE_OAUTH_TOKEN=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
