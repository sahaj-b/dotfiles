vim.g.mapleader = " "

local keymap = vim.keymap
-- keymap.set("x", "p", function() return 'pgv"' .. vim.v.register .. "y" end, { remap = false, expr = true })
keymap.set("n", "<leader>cl", "<cmd>set hlsearch<CR>")
keymap.set("n", "<leader><leader>z", "<cmd>set ls=0<CR>")
keymap.set("n", "ZA", "<cmd>qa<CR>")
keymap.set("n", "<leader>#", "/\\m^\\s*[^#]<CR>")

keymap.set("n", "<leader>/", "gcc", { remap = true })
keymap.set("v", "<leader>/", "gc", { remap = true })
keymap.set("x", "p", "P")

keymap.set("n", "zM", "<cmd>%foldc<CR>", { silent = true })
keymap.set("n", "<leader>zm", "<cmd>%foldc!<CR>", { silent = true })

keymap.set("n", "<leader>lt", "<cmd>!xdg-open https://leetcode.com/problems/<cword><CR>")
keymap.set("n", "<leader>tr", "<cmd>lua Transparent()<CR>", { silent = true })
keymap.set("n", "<leader>to", "<cmd>lua Opaque()<CR>", { silent = true })

keymap.set("n", "<leader>q", 'cs"`ysa`}')

keymap.set('n', '<leader>w', ':silent! noautocmd w<CR>', { noremap = true, silent = true })

keymap.set("x", "Q", "<cmd>norm @q<CR>")
keymap.set("n", "Q", "@q")

keymap.set("n", "<leader>s", "<cmd>w<CR>")
-- keymap.set("n", "<leader>s", function() vim.api.nvim_command('write') end)

--windows
-- keymap.set("n", "<M-h>", "<C-w>h")
-- keymap.set("n", "<M-j>", "<C-w>j")
-- keymap.set("n", "<M-k>", "<C-w>k")
-- keymap.set("n", "<M-l>", "<C-w>l")

keymap.set("n", "<leader>co", "<cmd>CodeiumToggle<CR>")

keymap.set("n", "<leader>cpd", "<cmd>Copilot disable<CR>")
keymap.set("n", "<leader>cpe", "<cmd>Copilot enable<CR>")

keymap.set("n", "<leader>p", '"0p')

keymap.set("n", "<esc>", "<cmd>noh<CR>", { silent = true })
keymap.set("n", "<leader>ch", function() vim.opt.hlsearch = not vim.opt.hlsearch._value end,
  { silent = true, desc = "Toggle Highlight search" })

keymap.set("v", "K", "<cmd>m '<-2<CR>gv=gv", { desc = "Move selection down" })
keymap.set("v", "J", "<cmd>m '>+1<CR>gv=gv", { desc = "Move selection up" })

keymap.set("n", "J", "mzJ`z")

-- Quick search and replace
keymap.set("n", "<leader>n", "*''cgn")
keymap.set("v", "<leader>n", "\"hy/<C-r>h<CR>Ncgn")

keymap.set("n", "<C-d>", "<C-d>zz")
keymap.set("n", "<C-u>", "<C-u>zz")
keymap.set("n", "n", "nzzzv")
keymap.set("n", "N", "Nzzzv")

-- keymap.set("n", "<leader>o", "o<ESC>")
-- keymap.set("n", "<leader>O", "o<ESC>")
-- keymap.set("i", "<C-o>", "<ESC>o")
keymap.set("n", "<C-o>", "<ESC>o<ESC>")

keymap.set("n", "<C-E>", "<C-O>", { noremap = true })

-- search and replace on recently c insert if forgot to search
keymap.set("n", "g.", '/\\V\\C<C-r>"<CR>cgn<C-a><Esc>')
keymap.set({ "n", "x" }, "<leader>d", '"_d')
keymap.set({ "n", "x" }, "<leader>D", '"_D')
keymap.set({ "n" }, "S", '"_S')
keymap.set({ "n", "x" }, "c", '"_c')
keymap.set({ "n", "x" }, "C", '"_C')

keymap.set("v", "y", "y`>")
keymap.set("v", "/", "<esc>/\\%V")
keymap.set("n", "<C-L>", "<cmd>vertical resize -5<CR>")
keymap.set("n", "<C-H>", "<cmd>vertical resize +5<CR>")

-- keymap.set("n", "<leader>k", "<cmd>lnext<CR>zz")
-- keymap.set("n", "<leader>j", "<cmd>lprev<CR>zz")

keymap.set("n", "<leader>rn", [[:%sno/\<<C-r><C-w>\>/<C-r><C-w>/gIc<Left><Left><Left><Left>]])
keymap.set("v", "<leader>rn", [["hy:%sno/<C-r>h/<C-r>h/gIc<left><left><left><Left>]])

keymap.set("n", "<leader>vpp", "<cmd>e ~/.config/nlua/sahaj/lazy.lua")
keymap.set("n", "x", '"_x')

keymap.set("n", "<leader>gd", "<cmd>lua vim.diagnostic.disable(0)<CR>")
keymap.set("n", "<leader>ge", "<cmd>lua vim.diagnostic.enable(0)<CR>")

keymap.set("t", "<esc>", "<C-\\><C-n>")

keymap.set("i", "<C-d>", "<Del>")

keymap.set({ "n", "v" }, "<C-n>", "nvgn")

keymap.set("n", "<leader>cd", "<cmd>cd %:h<CR>", { desc = "Change cwd to buffer dir" })

-- qflist
keymap.set("n", "<leader>;", "<cmd>cnext<CR>zz")
keymap.set("n", "<leader>,", "<cmd>cprev<CR>zz")
keymap.set("n", "<leader><leader>x", function() vim.diagnostic.setqflist() end)
keymap.set("n", "<leader><leader>c", "<cmd>cclose<CR>")

-- tabs
keymap.set("n", "<leader>]", "<cmd>tabnext<CR>")
keymap.set("n", "<leader>[", "<cmd>tabprev<CR>")

-- buffers
keymap.set("n", "H", "<cmd>bprev<CR>", { silent = true })
keymap.set("n", "L", "<cmd>bnext<CR>", { silent = true })

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

keymap.set("n", "<leader><leader>t", "<cmd>lua ToggleCheckbox()<CR>")
keymap.set("v", "<leader><leader>t", "<cmd>lua ToggleCheckboxVisual()<CR>")

--plugins-keymaps

-- diffview
-- keymap.set("n", "<leader><leader>d", "<cmd>DiffviewToggle<CR>")

-- Oil.nvim
-- open preview pane by default
keymap.set('n', '-', function()
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
keymap.set("n", "<leader>bt", function() vim.g.blink_cmp = not vim.g.blink_cmp end, { desc = "Toggle Blink" })

-- tailwind
keymap.set("n", "<leader>tc", "<cmd>TailwindConcealToggle<CR>")

--ccc
keymap.set("n", "<leader>cc", "<cmd>CccPick<CR>")

--undotree
keymap.set("n", "<leader>u", "<cmd>UndotreeToggle<CR>")

-- lsp

keymap.set("n", "gd", "<cmd>Telescope lsp_definitions<cr>", { desc = "[G]oto [D]efinition" })
keymap.set("n", "gr", "<cmd>Telescope lsp_references<cr>", { desc = "[G]oto [R]eferences" })
keymap.set("n", "gI", "<cmd>Telescope lsp_implementations<cr>", { desc = "[G]oto [I]mplementation" })
keymap.set("n", "gt", "<cmd>Telescope lsp_type_definitions<cr>", { desc = "Type [D]efinition" })
keymap.set("n", "gs", "<cmd>Telescope lsp_document_symbols<cr>", { desc = "[D]ocument [S]ymbols" })
keymap.set("n", "gS", "<cmd>Telescope lsp_dynamic_workspace_symbols<cr>", { desc = '[W]orkspace [S]ymbols' })
keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, { desc = "[C]ode [A]ction" })
keymap.set("n", "K", vim.lsp.buf.hover, { desc = "Hover Documentation" })
keymap.set("n", 'gD', vim.lsp.buf.declaration, { desc = '[G]oto [D]eclaration' })
keymap.set("n", "gd", "<cmd>lua vim.lsp.buf.definition()<CR>")
keymap.set("i", "<C-t>", "<Cmd>lua vim.lsp.buf.signature_help()<CR>")
keymap.set("n", "]d", "<cmd>lua vim.diagnostic.goto_next()<CR>")
keymap.set("n", "[d", "<cmd>lua vim.diagnostic.goto_prev()<CR>")
keymap.set("n", "<leader>o", "<cmd>lua vim.diagnostic.open_float()<CR>")
keymap.set("n", "<leader>ca", "<cmd>lua vim.lsp.buf.code_action()<CR>")
keymap.set("n", "<leader>lrf", "<cmd>lua vim.lsp.buf.references()<CR>")
keymap.set("n", "<leader>lrn", "<cmd>lua vim.lsp.buf.rename()<CR>")
keymap.set("n", "<leader>cmd", "<cmd>lua require('cmp').setup.buffer { enabled = false }<CR>")
keymap.set("n", "<leader>cme", "<cmd>lua require('cmp').setup.buffer { enabled = true }<CR>")

-- telescope
keymap.set("n", "<leader>fh", "<cmd>Telescope help_tags<cr>", { desc = "File Browser" })
keymap.set("n", "<leader>ff", "<cmd>Telescope find_files<cr>", { desc = "Fuzzy find files in cwd" })
keymap.set("n", "<leader>fo", "<cmd>Telescope oldfiles<cr>", { desc = "Fuzzy find recent files" })
keymap.set("n", "<leader>frs", "<cmd>Telescope live_grep<cr>", { desc = "Find string in cwd (regex)" })
keymap.set("n", "<leader>mg", function() require("sahaj.multigrep").setup() end, { desc = "Find string in cwd" })
keymap.set("n", "<leader>fzs", "<cmd>Telescope grep_string search=<cr>", { desc = "Find string in cwd (regex)" })
keymap.set("n", "<leader>fs",
  function() require("telescope.builtin").live_grep({ additional_args = "--fixed-string" }) end,
  { desc = "Find string in cwd" })
keymap.set("n", "<leader>fb", "<cmd>Telescope buffers<cr>", { desc = "Show open buffers" })
keymap.set("n", "<leader>gc", "<cmd>Telescope git_commits<cr>", { desc = "Show git commits" })
keymap.set("n", "<leader>gfc", "<cmd>Telescope git_bcommits<cr>", { desc = "Show git commits for current buffer" })
keymap.set("n", "<leader>gb", "<cmd>Telescope git_branches<cr>", { desc = "Show git branches" })
keymap.set("n", "<leader>gs", "<cmd>Telescope git_status<cr>", { desc = "Show current git changes per file" })
keymap.set("n", "<leader>ft", "<cmd>Telescope<cr>", { desc = "Open Telescope options" })
keymap.set("n", "<leader>fr", "<cmd>Telescope lsp_references<cr>", { desc = "Find lsp references" })
keymap.set("n", "<leader>fw", "<cmd>Telescope lsp_workspace_symbols<cr>", { desc = "Find workspace symbols" })

keymap.set('n', '<leader>fps', function()
    require("telescope.builtin").grep_string({ search = vim.fn.input("Grep > ") });
  end,
  { desc = "Find string, then filter with path" })

keymap.set('n', '<leader>fc', function()
    require("telescope.builtin").find_files({ cwd = require("telescope.utils").buffer_dir() });
  end,
  { desc = "Find files in buffer cwd" })

keymap.set('n', '<leader>fn', function()
    require("telescope.builtin").find_files({ cwd = "~/.config/nvim/" });
  end,
  { desc = "Find files in neovim config" })


-- Conform
keymap.set("n", "<leader>fm", function() require("conform").format() end, { desc = "Format(Trouble)" })
keymap.set("n", "<leader>ct", "<cmd>ConformToggle<CR>", { desc = "Toggle Format on save" })
keymap.set("n", "<leader>cb", "<cmd>ConformToggle!<CR>", { desc = "Toggle Format on save in current buffer" })
keymap.set("n", "<leader>ts",
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
    keymap.set("n", "<leader>1", "<cmd>3,$y<CR>:!~/scripts/automate paste<CR>")
    keymap.set("n", "<leader>2", "<cmd>3,$y<CR>:!~/scripts/automate run<CR>")
    keymap.set("n", "<leader>3", "<cmd>!~/scripts/automate copy<CR>")
    keymap.set("n", "<leader>4", "<cmd>3,$y<CR>:!~/scripts/automate run switch<CR>")
    keymap.set("n", "<leader>5", "<cmd>!~/scripts/automate copy switch<CR>")
  end
})
vim.api.nvim_create_autocmd("FileType", {
  pattern = "sql",
  callback = function()
    keymap.set("n", "<leader>2", "<cmd>%y<CR>:!~/scripts/automate db<CR>")
  end
})


--runners
local filetypes = {
  javascript = "node %",
  typescript = "npx tsx %",
  python = "python3 %",
  c = "gcc % -o %:r && ./%:r",
  cpp = "g++ % -o %:r && ./%:r",
  qml = "qmlscene %"
}

for ft, cmd in pairs(filetypes) do
  vim.api.nvim_create_autocmd("FileType", {
    pattern = ft,
    callback = function()
      vim.keymap.set("n", "<leader>9", "<cmd>!" .. cmd .. "<CR>", { buffer = true })
      vim.keymap.set("n", "<leader>8", "<cmd>!(footclient -a float -w1200x700 -e sh -c '" .. cmd .. ";read e'&)<CR>",
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

vim.keymap.set("n", "<leader>tw", ToggleDiagnostics, { desc = "Toggle warnings+errors/errors" })

-- -- trouble
--
-- keymap.set("n", "<leader>xt", "<cmd>Trouble toggle<cr>", { desc = "Close Trouble window(any)" })
-- keymap.set("n", "<leader>xd", "<cmd>Trouble diagnostics toggle<cr>", { desc = "Toggle Diagnostics" })
-- keymap.set("n", "<leader>xD", "<cmd>Trouble diagnostics toggle filter.buf=0<cr>",
--   { desc = "Buffer Diagnostics (Trouble)" })
-- keymap.set("n", "<leader>xs", "<cmd>Trouble symbols toggle<cr>", { desc = "Symbols (Trouble)" })
-- keymap.set("n", "<leader>xl", "<cmd>Trouble lsp toggle focus=false win.position=right<cr>",
--   { desc = "LSP Definitions / references / ... (Trouble)" })
-- keymap.set("n", "<leader>xL", "<cmd>Trouble loclist toggle<cr>", { desc = "Location List (Trouble)" })
-- keymap.set("n", "<leader>xq", "<cmd>Trouble qflist toggle<cr>", { desc = "Quickfix List (Trouble)" })
-- keymap.set("n", "<leader>;", function() require("trouble").next({ jump = true, skip_groups = true }) end,
--   { desc = "Next item (Trouble)" })
-- keymap.set("n", "<leader>,", function() require("trouble").prev({ jump = true, skip_groups = true }) end,
--   { desc = "Next item (Trouble)" })

-- markview
keymap.set("n", "<leader>mv", "<cmd>Markview<CR>", { desc = "Toggle Markview" })

-- rest
keymap.set("n", "<leader><leader>r", "<cmd>Rest run<CR>")
