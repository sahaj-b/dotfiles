vim.g.mapleader = " "

local map = vim.keymap.set

-- keymap.set("x", "p", function() return 'pgv"' .. vim.v.register .. "y" end, { remap = false, expr = true })
map("n", "<leader>cl", "<cmd>set hlsearch<CR>")
map("n", "<leader><leader>z", "<cmd>set ls=0<CR>")
map("n", "ZA", "<cmd>qa<CR>")
map("n", "<leader>#", "/\\m^\\s*[^#]<CR>")

map("n", "<leader>/", "gcc", { remap = true })
map("v", "<leader>/", "gc", { remap = true })
map("x", "p", "P")

CloseLevel = require("close-fold-level")
map("n", "<leader>zm", "<cmd>%foldc<CR>", { silent = true, desc = "Close level 1 folds" })
map("v", "<leader>zm", function() CloseLevel(1) end)
map({ "n", "v" }, "z2", function() CloseLevel(2) end, { desc = "Close level 2 folds" })
map({ "n", "v" }, "<leader>zn", function()
  vim.ui.input({ prompt = 'Level: ' }, function(input)
    CloseLevelRange(tonumber(input), vim.fn.line("'<"), vim.fn.line("'>"))
  end)
end, { desc = "Close level n folds" })

NavigateClosedFold = require("fold-navigate")
vim.keymap.set('n', ']z', function() NavigateClosedFold('next') end, { desc = 'Next closed fold' })
vim.keymap.set('n', '[z', function() NavigateClosedFold('prev') end, { desc = 'Prev closed fold' })


map("n", "<leader>lt", "<cmd>!xdg-open https://leetcode.com/problems/<cword><CR>")
map("n", "<leader>tr", "<cmd>lua Transparent()<CR>", { silent = true })
map("n", "<leader>to", "<cmd>lua Opaque()<CR>", { silent = true })

map("n", "<leader>q", 'cs"`ysa`}')

map('n', '<leader><leader>w', ':silent! noautocmd w<CR>', { noremap = true, silent = true })

map("x", "Q", "<cmd>norm @q<CR>")
map("n", "Q", "@q")

map("n", "<leader>w", "<cmd>w<CR>")
-- map("n", "<leader>w", "<cmd>silent w<CR>", { silent = true })


--windows
map("n", "<M-h>", "<C-w>h")
map("n", "<M-j>", "<C-w>j")
map("n", "<M-k>", "<C-w>k")
map("n", "<M-l>", "<C-w>l")
map("n", "<M-f>", "<C-w>|")

map("n", "<leader>co", "<cmd>CodeiumToggle<CR>")

map("n", "<leader>cpd", "<cmd>Copilot disable<CR>")
map("n", "<leader>cpe", "<cmd>Copilot enable<CR>")
map("n", "<leader>cn", "<cmd>Sidekick nes toggle<CR>")
-- map("n", "<leader>cpd", "<cmd>SupermavenStop<CR>")
-- map("n", "<leader>cpe", "<cmd>SupermavenStart<CR>")

map("n", "<leader>p", '"0p')

map("n", "<esc>", "<cmd>noh<CR>", { silent = true })
map("n", "<leader>ch", function() vim.opt.hlsearch = not vim.opt.hlsearch._value end,
  { silent = true, desc = "Toggle Highlight search" })

map("v", "K", "<cmd>m '<-2<CR>gv=gv", { desc = "Move selection down" })
map("v", "J", "<cmd>m '>+1<CR>gv=gv", { desc = "Move selection up" })

map("n", "J", "mzJ`z")

-- Quick search and replace
map("n", "<leader>n", "*''cgn")
map("v", "<leader>n", "\"hy/<C-r>h<CR>Ncgn")

map("n", "<C-d>", "<C-d>zz")
map("n", "<C-u>", "<C-u>zz")
map("n", "n", "nzzzv")
map("n", "N", "Nzzzv")

-- map("n", "<leader>o", "o<ESC>")
-- map("n", "<leader>O", "o<ESC>")
-- map("i", "<C-o>", "<ESC>o")
map("n", "<C-o>", "<ESC>o<ESC>")

map("n", "<C-e>", "<C-o>", { noremap = true })

-- search and replace on recently c insert if forgot to search
map("n", "g.", '/\\V\\C<C-r>z<CR>cgn<C-a><Esc>')
map({ "n", "x" }, "<leader>d", '"_d')
map({ "n", "x" }, "<leader>D", '"_D')
map({ "n" }, "S", '"_S')
map({ "n", "x" }, "c", '"zc')
map({ "n", "x" }, "C", '"zC')

map("v", "y", "y`>")
map("v", "/", "<esc>/\\%V")
map("n", "<C-L>", "<cmd>vertical resize -5<CR>")
map("n", "<C-H>", "<cmd>vertical resize +5<CR>")

-- map("n", "<leader>k", "<cmd>lnext<CR>zz")
-- map("n", "<leader>j", "<cmd>lprev<CR>zz")

map("n", "<leader>mrn", [[:%sno/\<<C-r><C-w>\>/<C-r><C-w>/gIc<Left><Left><Left><Left>]])
map("v", "<leader>mrn", [["hy:%sno/<C-r>h/<C-r>h/gIc<left><left><left><Left>]])

map("n", "<leader>vpp", "<cmd>e ~/.config/nlua/sahaj/lazy.lua")
map("n", "x", '"_x')

map("t", "<esc>", "<C-\\><C-n>")

map("i", "<C-d>", "<Del>")

-- map({ "n", "v" }, "<C-n>", "nvgn")

map("n", "<leader>cd", "<cmd>cd %:h<CR>", { desc = "Change cwd to buffer dir" })

-- qflist
map("n", "<leader>;", "<cmd>cnext<CR>zz")
map("n", "<leader>,", "<cmd>cprev<CR>zz")
map("n", "<leader><leader>x", function() vim.diagnostic.setqflist() end)
map("n", "<leader><leader>c", "<cmd>cclose<CR>")

-- tabs
map("n", "<leader>]", "<cmd>tabnext<CR>")
map("n", "<leader>[", "<cmd>tabprev<CR>")

-- buffers
map("n", "H", "<cmd>bprev<CR>", { silent = true })
map("n", "L", "<cmd>bnext<CR>", { silent = true })
map("n", "M", "<C-^>")

-- Toggle Checkboxes
function ToggleCheckbox()
  local line = vim.api.nvim_get_current_line()
  local uncheckedspace, _ = string.find(line, "- %[ %]")
  local unchecked, _ = string.find(line, "- %[%]")
  local checked, _ = string.find(line, "- %[x%]")
  local newLine

  if uncheckedspace ~= nil then
    newLine = string.gsub(line, "%[ %]", "[x]")
  elseif unchecked ~= nil then
    newLine = string.gsub(line, "%[%]", "[x]")
  elseif checked ~= nil then
    newLine = string.gsub(line, "%[x%]", "[ ]")
  else
    newLine = "- [ ] " .. line
  end
  vim.api.nvim_set_current_line(newLine)
end

function ToggleCheckboxVisual()
  local start_line = vim.fn.line("v")
  local end_line = vim.fn.line(".")
  local step = start_line <= end_line and 1 or -1

  for line_num = start_line, end_line, step do
    vim.cmd("normal! " .. line_num .. "gg")
    ToggleCheckbox()
  end
end

map("n", "<leader><leader>t", "<cmd>lua ToggleCheckbox()<CR>")
map("v", "<leader><leader>t", "<cmd>lua ToggleCheckboxVisual()<CR>")


vim.api.nvim_create_autocmd("FileType", {
  pattern = "go",
  callback = function()
    map("n", "T", "iif err != nil {<CR><CR><BS>}<up><tab>")
  end
})


-- macros
vim.fn.setreg("t", [[_f"ý5r`ý5f"ý5r`ý5a}hF`ý5i{]]) -- JS/TS: convert to template string

-- Plugins keymaps

-- Smear cursor
map("n", "<leader>sm", function()
  -- require('smear_cursor.color').unhide_real_cursor()
  -- require('smear_cursor.animation').replace_real_cursor()

  -- Reset the animation state
  require('smear_cursor.events').unlisten()
  require('smear_cursor.events').listen()
  require('smear_cursor.events').re_enable()

  -- :set guicursor&
  -- :set guicursor=n-v-c:block,i-ci-ve:ver25,r-cr:hor20,o:hor50
end, { desc = "Reset Smear cursor" })

-- Sidekick
map('v', '<leader>ai', function()
  vim.ui.input({ prompt = 'Prompt: ' }, function(prompt)
    if prompt and prompt ~= '' then
      require('sidekick.cli').send({
        selection = true,
        diagnostics = true,
        location = true,
        msg = prompt,
        submit = true
      })
    end
  end)
end, { desc = 'Sidekick Ask Prompt' })

map({ 'n', 'v' }, '<leader>af', function()
  vim.ui.input({ prompt = 'Prompt: ' }, function(prompt)
    if prompt and prompt ~= '' then
      require('sidekick.cli').send({
        prompt = "file",
        selection = true,
        diagnostics = true,
        location = true,
        msg = prompt,
        submit = true
      })
    end
  end)
end, { desc = 'Sidekick Ask Prompt with FILE' })


map({ "n", "x", "i", "t" }, "<c-g>", function() require("sidekick.cli").focus() end, { desc = "Sidekick Switch Focus" })

map({ "n", "v" }, "<c-q>", function() require("sidekick.cli").toggle({ focus = true }) end,
  { desc = "Sidekick Toggle CLI" }
)

map({ "n", "v" }, "<leader>ao", function() require("sidekick.cli").toggle({ name = "opencode", focus = true }) end,
  { desc = "Sidekick Opencode Toggle" })

map({ "n", "v" }, "<leader>ap", function() require("sidekick.cli").prompt() end, { desc = "Sidekick Ask Prompt" })

-- CodeCompanion
map({ "n", "v" }, "<leader>ci", ":CodeCompanion<cr>", { noremap = true, silent = true })
map({ "n", "v" }, "<leader>aa", "<cmd>CodeCompanionActions<cr>", { noremap = true, silent = true })
map("n", "<leader><leader>a", "<cmd>CodeCompanionChat Toggle<cr>", { noremap = true, silent = true })
map('ca', "cc", "CodeCompanion")
map('ca', "cch", "CodeCompanionHistory")


-- diffview
-- map("n", "<leader><leader>d", "<cmd>DiffviewToggle<CR>")

-- Oil.nvim
map('n', '<C-b>', function()
  local oil = require('oil')
  if vim.bo.filetype == "oil" then
    oil.close()
    return
  end

  oil.open()

  -- Wait until oil has opened, max 1 sec, then open preview
  vim.wait(1000, function()
    return oil.get_cursor_entry() ~= nil
  end)
  if oil.get_cursor_entry() then
    oil.open_preview()
    vim.defer_fn(function()
      vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("20<C-w><", true, false, true), "n", true)
    end, 50)
  end
end)
map('n', '-', function()
  local oil = require('oil')
  oil.open()

  -- Wait until oil has opened, max 1 sec, then open preview
  vim.wait(1000, function()
    return oil.get_cursor_entry() ~= nil
  end)
  if oil.get_cursor_entry() then
    oil.open_preview()
    vim.defer_fn(function()
      vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("20<C-w><", true, false, true), "n", true)
    end, 50)
  end
end)

-- blink
map("n", "<leader>bt", function() vim.g.blink_cmp = not vim.g.blink_cmp end, { desc = "Toggle Blink" })

-- tailwind
map("n", "<leader>tc", "<cmd>TailwindConcealToggle<CR>")

--ccc
map("n", "<leader>cc", "<cmd>CccPick<CR>")

--undotree
map("n", "<leader>u", "<cmd>UndotreeToggle<CR>")

-- Snacks.picker ---
map("n", "<leader>ff", function() Snacks.picker.smart() end, { desc = "Smart Find Files" })
map("n", "<leader>sb", function() Snacks.picker.buffers() end, { desc = "Buffers" })
map("n", "<leader>s:", function() Snacks.picker.command_history() end, { desc = "Command History" })
-- map("n", "<leader>e", function() Snacks.explorer() end, { desc = "File Explorer" })
-- find
map("n", "<leader>sb", function() Snacks.picker.buffers() end, { desc = "Buffers" })
map("n", "<leader>sc", function() Snacks.picker.files({ cwd = vim.fn.stdpath("config") }) end,
  { desc = "Find Config File" })
map("n", "<leader>sf", function() Snacks.picker.files() end, { desc = "Find Files" })
map("n", "<leader>sg", function() Snacks.picker.git_files() end, { desc = "Find Git Files" })
-- map("n", "<leader>sp", function() Snacks.picker.projects() end, { desc = "Projects" })
map("n", "<leader>so", function() Snacks.picker.recent() end, { desc = "Recent" })
-- git
map("n", "<leader>gb", function() Snacks.picker.git_branches() end, { desc = "Git Branches" })
map("n", "<leader>gl", function() Snacks.picker.git_log() end, { desc = "Git Log" })
map("n", "<leader>gL", function() Snacks.picker.git_log_line() end, { desc = "Git Log Line" })
map("n", "<leader>gs", function() Snacks.picker.git_status() end, { desc = "Git Status" })
map("n", "<leader>gS", function() Snacks.picker.git_stash() end, { desc = "Git Stash" })
map("n", "<leader>gd", function() Snacks.picker.git_diff() end, { desc = "Git Diff (Hunks)" })
map("n", "<leader>gf", function() Snacks.picker.git_log_file() end, { desc = "Git Log File" })
-- Grep
map("n", "<leader>ss", function() Snacks.picker.grep({ regex = false }) end, { desc = "Grep" })
map("n", "<leader>sR", function() Snacks.picker.grep() end, { desc = "Grep(Regex)" })
map({ "n", "x" }, "<leader>sv", function() Snacks.picker.grep_word() end, { desc = "Visual selection or word" })
-- search
map("n", '<leader>s"', function() Snacks.picker.registers() end, { desc = "Registers" })
map("n", '<leader>s/', function() Snacks.picker.search_history() end, { desc = "Search History" })
map("n", "<leader>sC", function() Snacks.picker.commands() end, { desc = "Commands" })
map("n", "<leader>sd", function() Snacks.picker.diagnostics() end, { desc = "Diagnostics" })
map("n", "<leader>sD", function() Snacks.picker.diagnostics_buffer() end, { desc = "Buffer Diagnostics" })
map("n", "<leader>sh", function() Snacks.picker.help() end, { desc = "Help Pages" })
map("n", "<leader>si", function() Snacks.picker.icons() end, { desc = "Icons" })
map("n", "<leader>sq", function() Snacks.picker.qflist() end, { desc = "Quickfix List" })
map("n", "<leader>sr", function() Snacks.picker.resume() end, { desc = "Resume" })
map("n", "<leader>su", function() Snacks.picker.undo() end, { desc = "Undo History" })
-- LSP
map("n", "gd", function() Snacks.picker.lsp_definitions() end, { desc = "Goto Definition" })
map("n", "gD", function() Snacks.picker.lsp_declarations() end, { desc = "Goto Declaration" })
map("n", "gr", function() Snacks.picker.lsp_references() end, { nowait = true, desc = "References" })
map("n", "gI", function() Snacks.picker.lsp_implementations() end, { desc = "Goto Implementation" })
map("n", "gt", function() Snacks.picker.lsp_type_definitions() end, { desc = "Goto T[y]pe Definition" })
map("n", "<leader>sW", function() Snacks.picker.lsp_symbols({ filter = { default = true } }) end,
  { desc = "LSP Symbols" })
map("n", "<leader>sw", function() Snacks.picker.lsp_workspace_symbols({ filter = { default = true } }) end,
  { desc = "LSP Workspace Symbols" })
map("n", "<leader>sp", function() Snacks.picker() end, { desc = "Pickers" })


map("n", "K", vim.lsp.buf.hover, { desc = "Hover Documentation" })
map("i", "<C-t>", vim.lsp.buf.signature_help, { desc = "Signature Help" })
map("n", "<leader>ca", vim.lsp.buf.code_action, { desc = "Code Action" })
map("n", "<leader>rn", vim.lsp.buf.rename, { desc = "LSP Rename" })
map("n", "<leader>o", vim.diagnostic.open_float, { desc = "Open Diagnostic Float" })
map("n", "<leader>ca", vim.lsp.buf.code_action, { desc = "LSP Code Action" })
map("n", "<leader>gd", function() vim.diagnostic.enable(false) end, { desc = "Disable Diagnostics" })
map("n", "<leader>ge", vim.diagnostic.enable, { desc = "Enable Diagnostics" })


-- Telescope
-- map("n", "<leader>cmd", "<cmd>lua require('cmp').setup.buffer { enabled = false }<CR>")
-- map("n", "<leader>cme", "<cmd>lua require('cmp').setup.buffer { enabled = true }<CR>")

-- map("n", "gd", "<cmd>Telescope lsp_definitions<cr>", { desc = "[G]oto [D]efinition" })
-- map("n", "gr", "<cmd>Telescope lsp_references<cr>", { desc = "[G]oto [R]eferences" })
-- map("n", "gI", "<cmd>Telescope lsp_implementations<cr>", { desc = "[G]oto [I]mplementation" })
-- map("n", "gt", "<cmd>Telescope lsp_type_definitions<cr>", { desc = "Type [D]efinition" })
-- map("n", "gS", "<cmd>Telescope lsp_document_symbols<cr>", { desc = "[D]ocument [S]ymbols" })

-- map("n", "<leader>sr", "<cmd>Telescope resume<cr>", { desc = "File Browser" })
-- map("n", "<leader>sh", "<cmd>Telescope help_tags<cr>", { desc = "File Browser" })
-- map("n", "<leader>sf", "<cmd>Telescope find_files<cr>", { desc = "Fuzzy find files in cwd" })
-- -- map('n', '<leader>sf', "<cmd>Telescope frecency workspace=CWD<cr>", { desc = "Search files in buffer cwd" })
-- map("n", "<leader>so", "<cmd>Telescope oldfiles<cr>", { desc = "Fuzzy find recent files" })
-- map("n", "<leader>so", function() Snacks.picker.recent() end, { desc = "Fuzzy find recent files" })
-- map("n", "<leader>sg", "<cmd>Telescope live_grep<cr>", { desc = "Search string in cwd (regex)" })
-- map("n", "<leader>su", "<cmd>Telescope grep_string search=<cr>", { desc = "Search string in cwd (regex)" })
-- map("n", "<leader>sw", "<cmd>Telescope lsp_dynamic_workspace_symbols<cr>", { desc = "Search workspace symbols" })
-- map("n", "<leader>sb", "<cmd>Telescope buffers<cr>", { desc = "Show open buffers" })
-- map("n", "<leader>gac", "<cmd>Telescope git_commits<cr>", { desc = "Show git commits" })
-- map("n", "<leader>gc", "<cmd>Telescope git_bcommits<cr>", { desc = "Show git commits for current buffer" })
-- map("n", "<leader>gb", "<cmd>Telescope git_branches<cr>", { desc = "Show git branches" })
-- map("n", "<leader>gs", "<cmd>Telescope git_status<cr>", { desc = "Show current git changes per file" })
-- map("n", "<leader>st", "<cmd>Telescope<cr>", { desc = "Open Telescope options" })
-- map("n", "<leader>sr", "<cmd>Telescope lsp_references<cr>", { desc = "Search lsp references" })

-- map("n", "<leader>ss",
--   function() require("telescope.builtin").live_grep({ additional_args = { "-F" } }) end,
--   { desc = "Search string in cwd" })
-- map("n", "<leader>ss", function() require("multigrep").setup() end,
--   { desc = "Find string in cwd with file filter" })
--
-- map('n', '<leader>sps', function()
--     require("telescope.builtin").grep_string({ search = vim.fn.input("Grep > ") });
--   end,
--   { desc = "Search string, then filter with path" })
--
-- map('n', '<leader>sc', function()
--     require("telescope.builtin").find_files({ cwd = require("telescope.utils").buffer_dir() });
--   end,
--   { desc = "Search files in buffer cwd" })
--
--
-- map('n', '<leader>sn', function()
--     require("telescope.builtin").find_files({ cwd = "~/.config/nvim/" });
--   end,
--   { desc = "Search files in neovim config" })
--

-- Conform
map("n", "<leader>fm", function() require("conform").format() end, { desc = "Format(Conform)" })
map("n", "<leader>ct", "<cmd>ConformToggle<CR>", { desc = "Toggle Format on save" })
map("n", "<leader>cb", "<cmd>ConformToggle!<CR>", { desc = "Toggle Format on save in current buffer" })
map("n", "<leader>ts",
  function()
    require("conform").format({ formatters = { "biome-tailwind" } })
  end,
  { desc = "Sorts Tailwind classes" }
)
map("n", "<leader>bf",
  function()
    require("conform").format({ formatters = { "biome-assist-linter" } })
  end,
  { desc = "Format with linter fixes (biome)" }
)

vim.api.nvim_create_autocmd('LspAttach', {
  callback = function(event)
    map('n', 'K', function()
      vim.lsp.buf.hover {
        border = 'rounded',
      }
    end, { buffer = event.buf })
  end,
})

-- automate

vim.api.nvim_create_autocmd("FileType", {
  pattern = "cpp",
  callback = function()
    map("n", "<leader>1", "<cmd>3,$y<CR>:!~/scripts/automate paste<CR>")
    map("n", "<leader>2", "<cmd>3,$y<CR>:!~/scripts/automate run<CR>")
    map("n", "<leader>3", "<cmd>!~/scripts/automate copy<CR>")
    map("n", "<leader>4", "<cmd>3,$y<CR>:!~/scripts/automate run switch<CR>")
    map("n", "<leader>5", "<cmd>!~/scripts/automate copy switch<CR>")
  end
})
vim.api.nvim_create_autocmd("FileType", {
  pattern = "sql",
  callback = function()
    map("n", "<leader>2", "<cmd>%y<CR>:!~/scripts/automate db<CR>")
  end
})

--runners
local filetypes = {
  javascript = "node %",
  typescript = "npx tsx %",
  python = "python3 %",
  c = "gcc % -o %:r && ./%:r",
  cpp = "g++ % -o %:r && ./%:r",
  qml = "qmlscene %",
  go = "if [ -f go.mod ]; then go run .; else go run %; fi",
  markdown = "go-grip %"
}

for ft, cmd in pairs(filetypes) do
  vim.api.nvim_create_autocmd("FileType", {
    pattern = ft,
    callback = function()
      map("n", "<leader>9", "<cmd>!" .. cmd .. "<CR>", { buffer = true })
      map("n", "<leader>8", "<cmd>!(footclient -a float -w1200x700 -e sh -c '" .. cmd .. ";read e'&)<CR>",
        { buffer = true })
    end
  })
end

local show_only_errors = false
function ToggleWarnings()
  if show_only_errors then
    vim.diagnostic.config({
      virtual_text = { severity = { min = vim.diagnostic.severity.WARN }, prefix = '•' }
    })
    show_only_errors = false
    print("Showing warnings and errors")
  else
    vim.diagnostic.config({
      virtual_text = { severity = { min = vim.diagnostic.severity.ERROR }, prefix = '•' }
    })
    show_only_errors = true
    print("Showing only errors")
  end
end

map("n", "<leader>tw", ToggleWarnings, { desc = "Toggle lsp warnings" })

-- -- trouble
--
-- map("n", "<leader>xt", "<cmd>Trouble toggle<cr>", { desc = "Close Trouble window(any)" })
-- map("n", "<leader>xd", "<cmd>Trouble diagnostics toggle<cr>", { desc = "Toggle Diagnostics" })
-- map("n", "<leader>xD", "<cmd>Trouble diagnostics toggle filter.buf=0<cr>",
--   { desc = "Buffer Diagnostics (Trouble)" })
-- map("n", "<leader>xs", "<cmd>Trouble symbols toggle<cr>", { desc = "Symbols (Trouble)" })
-- map("n", "<leader>xl", "<cmd>Trouble lsp toggle focus=false win.position=right<cr>",
--   { desc = "LSP Definitions / references / ... (Trouble)" })
-- map("n", "<leader>xL", "<cmd>Trouble loclist toggle<cr>", { desc = "Location List (Trouble)" })
-- map("n", "<leader>xq", "<cmd>Trouble qflist toggle<cr>", { desc = "Quickfix List (Trouble)" })
-- map("n", "<leader>;", function() require("trouble").next({ jump = true, skip_groups = true }) end,
--   { desc = "Next item (Trouble)" })
-- map("n", "<leader>,", function() require("trouble").prev({ jump = true, skip_groups = true }) end,
--   { desc = "Next item (Trouble)" })

-- markview
map("n", "<leader>mv", "<cmd>Markview<CR>", { desc = "Toggle Markview" })

-- rest
map("n", "<leader><leader>r", "<cmd>Rest run<CR>")

if vim.g.vscode then
  require("vscode-remaps")
end
