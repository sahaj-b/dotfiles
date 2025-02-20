-- require("sahaj.startup")
require("sahaj.remap")

vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- Lazy initialization
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  { import = "sahaj.plugins" }, }, {
  checker = { enabled = true, notify = false, },
  change_detection = { notify = false, },
})

vim.cmd [[colorscheme catppuccin
]]

-- Transparent 󰈸󰈸
function Transparent()
  vim.g.transparent = true
  vim.cmd [[colorscheme catppuccin
  hi lualine_c_normal guibg=none
  hi lualine_x_normal guibg=none
  hi Normal guibg=none ctermbg=none
  hi NormalFloat guibg=none ctermbg=none
  " hi LineNr guibg=none ctermbg=none
  hi Folded guibg=none ctermbg=none
  hi NonText guibg=none ctermbg=none
  hi SpecialKey guibg=none ctermbg=none
  hi VertSplit guibg=none ctermbg=none
  " hi SignColumn guibg=none ctermbg=none
  hi EndOfBuffer guibg=none ctermbg=none
  hi CursorLine guibg=none
  hi StatusLine none
  hi NormalNC guibg=none ctermbg=none
  hi TelescopePreviewNormal none
  hi TelescopePreviewBorder none
  hi TelescopeResultNormal none
  hi TelescopeResultBorder none
  hi TelescopePromptNormal none
  hi TelescopePromptBorder none
  hi TelescopePromptPrefix none
  hi TelescopeSelection none
  hi DiagnosticVirtualTextWarn none
  hi DiagnosticVirtualTextError none
  hi DiagnosticVirtualTextInfo none
  hi DiagnosticVirtualTextHint none
  " hi LocalHighlight guibg=none gui=underline
  " hi MiniCursorword guibg=none cterm=none guibg=none
  " hi MiniCursorwordCurrent guibg=none cterm=none gui=none
  hi IblScope guifg=#585b70
  hi TabLineSel guibg=#a6e3a1 guifg=#11111b
  hi TabLine  guifg=#cdd6f4
  hi FoldIcon guifg=#181825 guibg=#cba6f7 gui=bold
  ]]

  -- reload indent-blankline highlight
  require("ibl").setup { scope = { highlight = { "IblScope" }, }, }
  -- vim.g.minicursorword_disable = true
  -- enabled bordered completion menu
  -- local cmp = require("cmp")
  -- cmp.setup({ window = { completion = cmp.config.window.bordered({}) } })
end

function Opaque()
  -- vim.g.minicursorword_disable = false
  vim.g.transparent = false
  vim.cmd [[ colorscheme catppuccin
  " hi LocalHighlight guibg= guifg=none
  " hi MiniCursorword guibg=#313340 cterm=none gui=none
  " hi MiniCursorwordCurrent guibg=none cterm=none gui=none
  " hi CursorLine guibg=#181825
  " hi SignColumn guibg=#181825
  " hi CursorLineNr guibg=#181825
  " hi LineNr guibg=#181825
  hi Folded guibg=none
  hi FoldIcon guifg=#cba6f7 guibg=#432d5d gui=bold
  hi IblScope guifg=#585b70
  hi TabLineSel guibg=#a6e3a1 guifg=#11111b
  hi TabLine  guifg=#cdd6f4
  ]]

  --Telescope Colours
  local colors = require("catppuccin.palettes").get_palette()
  local TelescopeColor = {
    TelescopeMatching = { fg = colors.flamingo },
    TelescopeSelection = { fg = colors.text, bg = colors.surface0, bold = true },
    TelescopePromptPrefix = { bg = colors.surface0 },
    TelescopePromptNormal = { bg = colors.surface0 },
    TelescopeResultsNormal = { bg = colors.mantle },
    TelescopePreviewNormal = { bg = colors.mantle },
    TelescopePromptBorder = { bg = colors.surface0, fg = colors.surface0 },
    TelescopeResultsBorder = { bg = colors.mantle, fg = colors.mantle },
    TelescopePreviewBorder = { bg = colors.mantle, fg = colors.mantle },
    TelescopePromptTitle = { bg = colors.pink, fg = colors.mantle },
    TelescopeResultsTitle = { fg = colors.mantle },
    TelescopePreviewTitle = { bg = colors.green, fg = colors.mantle },
  }

  for hl, col in pairs(TelescopeColor) do
    vim.api.nvim_set_hl(0, hl, col)
  end

  -- reload indent-blankline highlight
  require("ibl").setup { scope = { highlight = { "IblScope" }, }, }

  -- disable bordered completion menu
  -- local cmp = require("cmp")
  -- cmp.setup({
  --   window = {
  --     completion = cmp.config.window.bordered({
  --       border = "none",
  --       winhighlight = "NormalFloat:NormalFloat,FloatBorder:FloatBorder",
  --     })
  --   }
  -- })
end

-- Opaque()
Transparent()
-- vim.api.nvim_set_hl(0, 'FoldIcon', { fg = "#afb4f9", bg = "#2a2b3d", bold = true })

function CopilotToCodeium()
  vim.cmd [[ Copilot disable ]]
  vim.api.nvim_command("CodeiumEnable")
  require('lualine').setup {
    sections = {
      lualine_y = { function() return "{.}%3{codeium#GetStatusString()}" end, 'progress' },
    },
  }
end

-- vim.g.codeium_enabled = false
vim.opt.showmode = false
vim.opt.breakindent = true
vim.opt.signcolumn = 'auto'
vim.g.tailwindSortOnSave = true
vim.opt.guicursor = {
  "n-v-c:block-Cursor",
  "i-ci-ve:ver25-Cursor",
  "r-cr:hor20-Cursor",
  "o:hor50-Cursor",
}

vim.g.tailwindSortOnSave = true

vim.opt.conceallevel = 2
-- vim.opt.concealcursor = 'nc'
vim.opt.magic = false

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
-- vim.opt.hlsearch = false

vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undodir = os.getenv("HOME") .. "/.vim/undodir"
vim.opt.undofile = true

vim.opt.incsearch = true

vim.opt.termguicolors = true

vim.opt.scrolloff = 8
vim.opt.signcolumn = "yes"
vim.opt.isfname:append("@-@")

vim.opt.updatetime = 500

-- vim.opt.autoindent = true

vim.opt.ignorecase = true
vim.opt.smartcase = true

vim.opt.cursorline = true

vim.opt.clipboard:append("unnamedplus")
-- vim.opt.iskeyword:append("-")

vim.opt.nrformats:append("unsigned")

-- folds
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "nvim_treesitter#foldexpr()"
vim.opt.foldenable = true
vim.opt.foldlevel = 1
vim.opt.foldlevelstart = 99
vim.opt.foldnestmax = 4
vim.opt.foldminlines = 1
vim.opt.foldcolumn = "0"
vim.opt.fillchars = "fold: ,foldopen:,foldsep:│,foldclose:"
function foldtext()
  local pos = vim.v.foldstart
  local line = vim.api.nvim_buf_get_lines(0, pos - 1, pos, false)[1]
  return {
    { line .. " " },
    { " ⋯ ", "FoldIcon" }
  }
end

vim.opt.foldtext = "v:lua.foldtext()"

local cmp_enabled = true
vim.api.nvim_create_user_command("ToggleAutoComplete", function()
  if cmp_enabled then
    require("cmp").setup.buffer({ enabled = false })
    cmp_enabled = false
  else
    require("cmp").setup.buffer({ enabled = true })
    cmp_enabled = true
  end
end, {})

vim.filetype.add({
  extension = {
    env = "dotenv",
  },
  filename = {
    [".env"] = "dotenv",
  },
  pattern = {
    ["%.env%.[%w_.-]+"] = "dotenv",
  },
})
-- -- Status Column for folding
-- local fcs = vim.opt.fillchars:get()
-- local function get_fold(lnum)
--   if vim.fn.foldlevel(lnum) <= vim.fn.foldlevel(lnum - 1) then return ' ' end
--   local fold_sym = vim.fn.foldclosed(lnum) == -1 and fcs.foldopen or fcs.foldclose
--   return fold_sym
-- end
-- _G.get_statuscol = function()
--   return "%s%l " .. get_fold(vim.v.lnum) .. " "
-- end
-- vim.o.statuscolumn = "%!v:lua.get_statuscol()"

-- vim.api.nvim_create_autocmd("QuickFixCmdPost", {
--   callback = function()
--     vim.cmd([[Trouble qflist open]])
--   end,
-- })

vim.api.nvim_create_autocmd("BufEnter", {
  callback = function()
    vim.opt.formatoptions:remove { "c", "r", "o" }
  end,
  desc = "Disable Commenting on New Line",
})
vim.api.nvim_create_autocmd("TextYankPost", {
  group = vim.api.nvim_create_augroup("highlight_yank", { clear = true }),
  callback = function()
    vim.highlight.on_yank({ higroup = "Search", timeout = 150 })
  end,
})
vim.api.nvim_create_autocmd("BufWritePre", {
  pattern = "*.jsx,*.tsx",
  group = vim.api.nvim_create_augroup("TailwindSortSync", { clear = true }),
  callback = function()
    if vim.g.TailwindSortOnSave then
      vim.cmd("TailwindSortSync")
    end
  end,
})

vim.api.nvim_create_autocmd("FileType", {
  pattern = { "json" },
  callback = function()
    vim.api.nvim_set_option_value("formatprg", "jq", { scope = 'local' })
  end,
})

-- Check and create .rgignore if it doesn't exist
-- so that Telescope also indexes .env files
local home = os.getenv "HOME"
local rgignore_path = home .. "/.rgignore"
local rgignore_file = io.open(rgignore_path, "r")

if not rgignore_file then
  rgignore_file = io.open(rgignore_path, "w")
  if rgignore_file then
    rgignore_file:write "!.env*\n"
    rgignore_file:close()
  end
else
  rgignore_file:close()
end
-- local codeiumString = " {.}%3{codeium#GetStatusString()}"
-- vim.o.statusline = " "
--     .. "  "
--     .. " %F"
--     .. " %#StatusModified#"
--     .. " %m"
--     .. " %#StatusNorm#"
--     .. "%="
--     .. "%y"
--     .. " %#StatusBuffer#"
--     .. "  "
--     .. "%n"
--     .. "%#StatusLocation#"
--     .. " %l,%c"
--     .. " %#StatusPercent#"
--     .. " %p%%  "
--     .. codeiumString
vim.cmd [[Copilot disable]]


-- foldtext with treesitter syntax highlighting, slows down neovim
-- function foldtext()
--   local pos = vim.v.foldstart
--   local line = vim.api.nvim_buf_get_lines(0, pos - 1, pos, false)[1]
--   local lang = vim.treesitter.language.get_lang(vim.bo.filetype)
--   local parser = vim.treesitter.get_parser(0, lang)
--   local query = vim.treesitter.query.get(parser:lang(), "highlights")
--
--   if query == nil then
--     return vim.fn.foldtext()
--   end
--
--   local tree = parser:parse({ pos - 1, pos })[1]
--   local result = {}
--
--   local line_pos = 0
--
--   local prev_range = nil
--
--   for id, node, _ in query:iter_captures(tree:root(), 0, pos - 1, pos) do
--     local name = query.captures[id]
--     local start_row, start_col, end_row, end_col = node:range()
--     if start_row == pos - 1 and end_row == pos - 1 then
--       local range = { start_col, end_col }
--       if start_col > line_pos then
--         table.insert(result, { line:sub(line_pos + 1, start_col), "Folded" })
--       end
--       line_pos = end_col
--       local text = vim.treesitter.get_node_text(node, 0)
--       if prev_range ~= nil and range[1] == prev_range[1] and range[2] == prev_range[2] then
--         result[#result] = { text, "@" .. name }
--       else
--         table.insert(result, { text, "@" .. name })
--       end
--       prev_range = range
--     end
--   end
--   local fold_lines = vim.v.foldend - pos + 1
--   table.insert(result, { " 󰁂 " .. fold_lines .. " ", "FoldIcon" })
--   return result
-- end



-- -- Overcomplicated Asynchrounous and cached folding text with treesitter syntax highlighting, but it works
-- -- Global cache table: for each buffer, cache results per fold start line.
-- local foldtext_cache = {}
--
-- -- A helper function that does the heavy work.
-- local function compute_foldtext(bufnr, pos)
--   local line = vim.api.nvim_buf_get_lines(bufnr, pos - 1, pos, false)[1]
--   local ft = vim.bo.filetype
--   local lang = vim.treesitter.language.get_lang(ft)
--   if not lang then
--     return vim.fn.foldtext() -- fallback: returns a plain string
--   end
--
--   local parser = vim.treesitter.get_parser(bufnr, lang)
--   local query = vim.treesitter.query.get(parser:lang(), "highlights")
--   if not query then
--     return vim.fn.foldtext()
--   end
--
--   local tree = parser:parse({ pos - 1, pos })[1]
--   local result_parts = {}
--   local line_pos = 0
--   local prev_range = nil
--
--   for id, node, _ in query:iter_captures(tree:root(), bufnr, pos - 1, pos) do
--     local name = query.captures[id]
--     local start_row, start_col, end_row, end_col = node:range()
--     if start_row == pos - 1 and end_row == pos - 1 then
--       local range = { start_col, end_col }
--       if start_col > line_pos then
--         table.insert(result_parts, { line:sub(line_pos + 1, start_col), "Folded" })
--       end
--       line_pos = end_col
--       local text = vim.treesitter.get_node_text(node, bufnr)
--       if prev_range and range[1] == prev_range[1] and range[2] == prev_range[2] then
--         result_parts[#result_parts] = { text, "@" .. name }
--       else
--         table.insert(result_parts, { text, "@" .. name })
--       end
--       prev_range = range
--     end
--   end
--
--   local fold_lines = vim.v.foldend - pos + 1
--   table.insert(result_parts, { " 󰁂 " .. fold_lines .. " ", "FoldIcon" })
--   -- Return the list of chunks to preserve per-chunk highlights.
--   return result_parts
-- end
--
-- -- Async updater: when called, schedules a background computation.
-- local function update_foldtext_async(bufnr, pos)
--   local timer = vim.loop.new_timer()
--   timer:start(0, 0, function()
--     -- Schedule the computation to run on the main thread
--     vim.schedule(function()
--       local text = compute_foldtext(bufnr, pos)
--       foldtext_cache[bufnr] = foldtext_cache[bufnr] or {}
--       foldtext_cache[bufnr][pos] = text
--       vim.cmd("redraw")
--     end)
--     timer:stop()
--     timer:close()
--   end)
-- end
--
-- -- Our foldtext callback: it returns cached text if available; otherwise, kick off an async update.
-- function foldtext()
--   local pos = vim.v.foldstart
--   local bufnr = vim.api.nvim_get_current_buf()
--   foldtext_cache[bufnr] = foldtext_cache[bufnr] or {}
--   if foldtext_cache[bufnr][pos] then
--     return foldtext_cache[bufnr][pos]
--   else
--     -- Start async computation if not already in progress.
--     update_foldtext_async(bufnr, pos)
--     -- Return a temporary placeholder.
--     return vim.fn.foldtext()
--   end
-- end
