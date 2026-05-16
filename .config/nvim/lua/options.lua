-- vim.g.codeium_enabled = false
-- vim.opt.cmdheight = 0
vim.o.shada = "!,'500,<50,s10,h"
vim.g.blink_cmp = true
vim.opt.showmode = false
vim.opt.breakindent = true
-- vim.opt.signcolumn = 'auto'
vim.opt.signcolumn = 'yes'
vim.g.tailwindSortOnSave = false
vim.opt.guicursor = {
  "n-v-c:block-Cursor",
  "i-ci-ve:ver25-Cursor",
  "r-cr:hor20-Cursor",
  "o:hor50-Cursor",
}

-- vim.g.codecompanion_auto_tool_mode = true

vim.opt.magic = false

vim.o.laststatus = 3
-- vim.opt.conceallevel = 2
-- vim.opt.concealcursor = 'nc'


vim.opt.statuscolumn = "%s %l "

vim.opt.inccommand = 'split'

vim.opt.mouse = 'a'

vim.opt.nu = true
vim.opt.rnu = true

vim.opt.tabstop = 2
vim.opt.softtabstop = 2
vim.opt.shiftwidth = 2
vim.opt.expandtab = true

vim.opt.splitright = true
vim.opt.splitbelow = true

vim.opt.smartindent = true

-- vim.opt.wrap = false
vim.opt.hlsearch = false

vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undodir = os.getenv("HOME") .. "/.vim/undodir"
vim.opt.undofile = true

vim.opt.incsearch = true

vim.opt.termguicolors = true

vim.opt.scrolloff = 8
vim.opt.isfname:append("@-@")

vim.opt.updatetime = 500

-- vim.opt.autoindent = true

vim.opt.ignorecase = true
vim.opt.smartcase = true

vim.opt.cursorline = true

vim.opt.clipboard:append("unnamedplus")
-- vim.opt.iskeyword:append("-")

vim.opt.nrformats:append("unsigned")

-- folds (using ufo now)
-- vim.opt.foldmethod = "expr"
-- vim.opt.foldexpr = "nvim_treesitter#foldexpr()"
-- vim.opt.foldenable = true
vim.opt.foldlevel = 99
vim.opt.foldlevelstart = 99
-- vim.opt.foldnestmax = 4
-- vim.opt.fillchars = "fold: ,foldopen:,foldsep:│,foldclose:"
vim.opt.foldcolumn = "0"
