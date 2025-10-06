-- require("startup")
require("remap")
require("options")

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

if vim.g.vscode then
  require("lazy").setup({
    { import = "vscode-plugins" }, }, {
    checker = { enabled = true, notify = false, },
    change_detection = { notify = false, },
  })
else
  require("lazy").setup({
    { import = "plugins" }, }, {
    checker = { enabled = true, notify = false, },
    change_detection = { notify = false, },
  })
end

-- vim.api.nvim_create_autocmd("TextYankPost", {
--   group = vim.api.nvim_create_augroup("highlight_yank", { clear = true }),
--   callback = function()
--     vim.highlight.on_yank({ higroup = "Search", timeout = 150 })
--   end,
-- })

vim.g.augment_workspace_folders = { '~/projects/binge-meter/' }

if vim.g.vscode then return end

vim.cmd [[
colorscheme catppuccin
hi! link BlinkCmpDoc BlinkCmpMenu
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
hi LineNr guifg=#6c7086
  hi NormalNC guibg=none ctermbg=none
  hi DiagnosticVirtualTextWarn none
  hi DiagnosticVirtualTextError none
  hi DiagnosticVirtualTextInfo none
  hi DiagnosticVirtualTextHint none

  hi FloatBorder guibg=none
  hi IblScope guifg=#585b70

  hi TabLineSel guibg=#a6e3a1 guifg=#11111b
  hi TabLine  guifg=#cdd6f4
  hi UfoFoldedEllipsis guifg=#181825 guibg=#cba6f7 gui=bold
  ]]

  -- reload indent-blankline highlight
  -- require("ibl").setup { scope = { highlight = { "IblScope" }, show_start = false, show_end = false }, }
end

function Opaque()
  -- vim.g.minicursorword_disable = false
  vim.g.transparent = false
  vim.cmd [[ colorscheme catppuccin
  hi LineNr guifg=#6c7086
  hi Folded guibg=none
  hi UfoFoldedEllipsis guifg=#cba6f7 guibg=#432d5d gui=bold
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

  local SnacksPickerColors = {
    SnacksPickerBorder = { fg = colors.surface0, bg = colors.mantle },
    SnacksPickerPreviewBorder = { fg = colors.mantle, bg = colors.mantle },
    SnacksPickerPreviewTitle = { fg = colors.mantle, bg = colors.green },
    SnacksPickerBoxBorder = { fg = colors.mantle, bg = colors.mantle },
    SnacksPickerDir = { fg = colors.overlay1 },
    -- SnacksPickerInputBorder = { fg = colors.mantle, bg = colors.mantle },
    -- SnacksPickerInput = { bg = colors.surface0 },
    -- SnacksPickerInputSearch = { fg = colors.text, bg = colors.surface0 },
    SnacksPickerListBorder = { fg = colors.mantle, bg = colors.mantle },
    SnacksPickerListCursorLine = { bg = colors.surface0 },
    SnacksPickerTitle = { fg = colors.mantle, bg = colors.pink },
    SnacksPickerList = { bg = colors.mantle },
    SnacksPickerListTitle = { fg = colors.mantle, bg = colors.red },
  }

  for hl, col in pairs(TelescopeColor) do
    vim.api.nvim_set_hl(0, hl, col)
  end
  for hl, col in pairs(SnacksPickerColors) do
    vim.api.nvim_set_hl(0, hl, col)
  end

  -- reload indent-blankline highlight
  -- require("ibl").setup { scope = { highlight = { "IblScope" }, show_start = false, show_end = false }, }

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

-- firenvim
if vim.g.started_by_firenvim == true then
  Opaque()
else
  Opaque()
  -- Transparent()
end

-- styles
vim.cmd [[
  "hi SnacksIndentScope guifg=#9f9f9f
  "hi SnacksIndent guifg=#585b70
  " snippet sometimes stuck in highlight like in className="stuff"
  hi SnippetTabstop guibg=none guifg=none
]]

vim.api.nvim_create_autocmd({ 'UIEnter' }, {
  callback = function()
    local client = vim.api.nvim_get_chan_info(vim.v.event.chan).client
    if client ~= nil and client.name == "Firenvim" then
      vim.o.laststatus = 0
      vim.o.cmdheight = 0
      if vim.o.lines < 5 then
        vim.o.lines = 5
      end
    end
  end
})

vim.g.firenvim_config = {
  localSettings = {
    [".*"] = {
      takeover = "never"
    }
  }
}

function CopilotToCodeium()
  vim.cmd [[ Copilot disable ]]
  vim.api.nvim_command("CodeiumEnable")
  require('lualine').setup {
    sections = {
      lualine_y = { function() return "{.}%3{codeium#GetStatusString()}" end, 'progress' },
    },
  }
end

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

vim.api.nvim_create_autocmd("BufEnter", {
  callback = function()
    vim.opt.formatoptions:remove { "c", "r", "o" }
  end,
  desc = "Disable Commenting on New Line",
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

local augroup = vim.api.nvim_create_augroup("allfilesindent", { clear = true })

vim.api.nvim_create_autocmd("FileType", {
  group = augroup,
  pattern = "*",
  callback = function()
    vim.opt_local.tabstop = 2
    vim.opt_local.shiftwidth = 2
    vim.opt_local.softtabstop = 2
  end,
})

vim.deprecate = function() end

-- require("rest-nvim-extract")

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
-- vim.cmd [[Copilot disable]]
