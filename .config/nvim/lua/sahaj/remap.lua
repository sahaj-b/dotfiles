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

map("n", "zM", "<cmd>%foldc<CR>", { silent = true })
map("n", "<leader>zm", "<cmd>%foldc!<CR>", { silent = true })

map("n", "<leader>lt", "<cmd>!xdg-open https://leetcode.com/problems/<cword><CR>")
map("n", "<leader>tr", "<cmd>lua Transparent()<CR>", { silent = true })
map("n", "<leader>to", "<cmd>lua Opaque()<CR>", { silent = true })

map("n", "<leader>q", 'cs"`ysa`}')

map('n', '<leader>w', ':silent! noautocmd w<CR>', { noremap = true, silent = true })

map("x", "Q", "<cmd>norm @q<CR>")
map("n", "Q", "@q")

map("n", "<leader>s", "<cmd>w<CR>")
-- map("n", "<leader>s", function() vim.api.nvim_command('write') end)

--windows
-- map("n", "<M-h>", "<C-w>h")
-- map("n", "<M-j>", "<C-w>j")
-- map("n", "<M-k>", "<C-w>k")
-- map("n", "<M-l>", "<C-w>l")

map("n", "<leader>co", "<cmd>CodeiumToggle<CR>")

map("n", "<leader>cpd", "<cmd>Copilot disable<CR>")
map("n", "<leader>cpe", "<cmd>Copilot enable<CR>")

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

map("n", "<C-E>", "<C-O>", { noremap = true })

-- search and replace on recently c insert if forgot to search
map("n", "g.", '/\\V\\C<C-r>"<CR>cgn<C-a><Esc>')
map({ "n", "x" }, "<leader>d", '"_d')
map({ "n", "x" }, "<leader>D", '"_D')
map({ "n" }, "S", '"_S')
map({ "n", "x" }, "c", '"_c')
map({ "n", "x" }, "C", '"_C')

map("v", "y", "y`>")
map("v", "/", "<esc>/\\%V")
map("n", "<C-L>", "<cmd>vertical resize -5<CR>")
map("n", "<C-H>", "<cmd>vertical resize +5<CR>")

-- map("n", "<leader>k", "<cmd>lnext<CR>zz")
-- map("n", "<leader>j", "<cmd>lprev<CR>zz")

map("n", "<leader>rn", [[:%sno/\<<C-r><C-w>\>/<C-r><C-w>/gIc<Left><Left><Left><Left>]])
map("v", "<leader>rn", [["hy:%sno/<C-r>h/<C-r>h/gIc<left><left><left><Left>]])

map("n", "<leader>vpp", "<cmd>e ~/.config/nlua/sahaj/lazy.lua")
map("n", "x", '"_x')

map("n", "<leader>gd", "<cmd>lua vim.diagnostic.enable(false)<CR>")
map("n", "<leader>ge", "<cmd>lua vim.diagnostic.enable()<CR>")

map("t", "<esc>", "<C-\\><C-n>")

map("i", "<C-d>", "<Del>")

map({ "n", "v" }, "<C-n>", "nvgn")

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
  local start_line = vim.fn.line("'<")
  local end_line = vim.fn.line("'>")

  for line_num = start_line, end_line do
    vim.cmd("normal! " .. line_num .. "gg")
    ToggleCheckbox()
    -- vim.api.nvim_buf_set_line(0, line_num - 1, line_num - 1, false, ToggleLineCheckbox(vim.api.nvim_buf_get_lines(0, line_num - 1, line_num, false)[1]))
  end
end

map("n", "<leader><leader>t", "<cmd>lua ToggleCheckbox()<CR>")
map("v", "<leader><leader>t", "<cmd>lua ToggleCheckboxVisual()<CR>")

--plugins-keymaps

-- CodeCompanion
map({ 'n', 'v' }, "<leader>aa", "<cmd>CodeCompanionActions<cr>")
map('n', "<leader><leader>a", "<cmd>CodeCompanionChat Toggle<cr>")
map('ca', "cc", "CodeCompanion")


-- diffview
-- map("n", "<leader><leader>d", "<cmd>DiffviewToggle<CR>")

-- Oil.nvim
-- open preview pane by default
map('n', '-', function()
  local oil = require('oil')
  oil.open()

  -- Wait until oil has opened, for a maximum of 1 second.
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

-- lsp
vim.api.nvim_create_autocmd('LspAttach', {
  callback = function(event)
    map('n', 'K', function()
      vim.lsp.buf.hover {
        border = 'rounded',
      }
    end, { buffer = event.buf })
  end,
})

map("n", "gd", "<cmd>Telescope lsp_definitions<cr>", { desc = "[G]oto [D]efinition" })
map("n", "gr", "<cmd>Telescope lsp_references<cr>", { desc = "[G]oto [R]eferences" })
map("n", "gI", "<cmd>Telescope lsp_implementations<cr>", { desc = "[G]oto [I]mplementation" })
map("n", "gt", "<cmd>Telescope lsp_type_definitions<cr>", { desc = "Type [D]efinition" })
map("n", "gs", "<cmd>Telescope lsp_document_symbols<cr>", { desc = "[D]ocument [S]ymbols" })
map("n", "gS", "<cmd>Telescope lsp_dynamic_workspace_symbols<cr>", { desc = '[W]orkspace [S]ymbols' })
map("n", "<leader>ca", vim.lsp.buf.code_action, { desc = "[C]ode [A]ction" })
map("n", "K", vim.lsp.buf.hover, { desc = "Hover Documentation" })
map("n", 'gD', vim.lsp.buf.declaration, { desc = '[G]oto [D]eclaration' })
map("n", "gd", "<cmd>lua vim.lsp.buf.definition()<CR>")
map("i", "<C-t>", "<Cmd>lua vim.lsp.buf.signature_help()<CR>")
map("n", "]d", "<cmd>lua vim.diagnostic.goto_next()<CR>")
map("n", "[d", "<cmd>lua vim.diagnostic.goto_prev()<CR>")
map("n", "<leader>o", "<cmd>lua vim.diagnostic.open_float()<CR>")
map("n", "<leader>ca", "<cmd>lua vim.lsp.buf.code_action()<CR>")
map("n", "<leader>lrf", "<cmd>lua vim.lsp.buf.references()<CR>")
map("n", "<leader>lrn", "<cmd>lua vim.lsp.buf.rename()<CR>")
map("n", "<leader>cmd", "<cmd>lua require('cmp').setup.buffer { enabled = false }<CR>")
map("n", "<leader>cme", "<cmd>lua require('cmp').setup.buffer { enabled = true }<CR>")

-- telescope
map("n", "<leader>fh", "<cmd>Telescope help_tags<cr>", { desc = "File Browser" })
map("n", "<leader>ff", "<cmd>Telescope find_files<cr>", { desc = "Fuzzy find files in cwd" })
map("n", "<leader>fo", "<cmd>Telescope oldfiles<cr>", { desc = "Fuzzy find recent files" })
map("n", "<leader>frs", "<cmd>Telescope live_grep<cr>", { desc = "Find string in cwd (regex)" })
map("n", "<leader>mg", function() require("sahaj.multigrep").setup() end, { desc = "Find string in cwd" })
map("n", "<leader>fzs", "<cmd>Telescope grep_string search=<cr>", { desc = "Find string in cwd (regex)" })
map("n", "<leader>fs",
  function() require("telescope.builtin").live_grep({ additional_args = "--fixed-string" }) end,
  { desc = "Find string in cwd" })
map("n", "<leader>fb", "<cmd>Telescope buffers<cr>", { desc = "Show open buffers" })
map("n", "<leader>gc", "<cmd>Telescope git_commits<cr>", { desc = "Show git commits" })
map("n", "<leader>gfc", "<cmd>Telescope git_bcommits<cr>", { desc = "Show git commits for current buffer" })
map("n", "<leader>gb", "<cmd>Telescope git_branches<cr>", { desc = "Show git branches" })
map("n", "<leader>gs", "<cmd>Telescope git_status<cr>", { desc = "Show current git changes per file" })
map("n", "<leader>ft", "<cmd>Telescope<cr>", { desc = "Open Telescope options" })
map("n", "<leader>fr", "<cmd>Telescope lsp_references<cr>", { desc = "Find lsp references" })
map("n", "<leader>fw", "<cmd>Telescope lsp_dynamic_workspace_symbols<cr>", { desc = "Find workspace symbols" })

map('n', '<leader>fps', function()
    require("telescope.builtin").grep_string({ search = vim.fn.input("Grep > ") });
  end,
  { desc = "Find string, then filter with path" })

map('n', '<leader>fc', function()
    require("telescope.builtin").find_files({ cwd = require("telescope.utils").buffer_dir() });
  end,
  { desc = "Find files in buffer cwd" })

map('n', '<leader>fn', function()
    require("telescope.builtin").find_files({ cwd = "~/.config/nvim/" });
  end,
  { desc = "Find files in neovim config" })


-- Conform
map("n", "<leader>fm", function() require("conform").format() end, { desc = "Format(Trouble)" })
map("n", "<leader>ct", "<cmd>ConformToggle<CR>", { desc = "Toggle Format on save" })
map("n", "<leader>cb", "<cmd>ConformToggle!<CR>", { desc = "Toggle Format on save in current buffer" })
map("n", "<leader>ts",
  function()
    local conform = require("conform")
    conform.formatters.prettier = { prepend_args = { "--plugin=prettier-plugin-tailwindcss" } }
    conform.format({ formatters = { "prettier" } })
    conform.formatters.prettier = { prepend_args = {} }
  end,
  { desc = "sorts Tailwind classes (prettier plugin)" }
)

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
  go = "go run .",
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
function ToggleDiagnostics()
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

map("n", "<leader>tw", ToggleDiagnostics, { desc = "Toggle warnings+errors/errors" })

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
