local map = vim.keymap.set

map("n", "L", "<cmd>lua require('vscode').action('workbench.action.nextEditorInGroup')<cr>")
map("n", "H", "<cmd>lua require('vscode').action('workbench.action.previousEditorInGroup')<cr>")

map("n", "<esc>", "<cmd>lua require('vscode').action('errorLens.updateEverything')<cr>")

map("n", "<C-f>", "<cmd>lua require('vscode').action('actions.find')<cr>")
map("n", "<leader><leader>w", "<cmd>lua require('vscode').action('workbench.action.files.saveWithoutFormatting')<cr>")

map("x", "J", "<cmd>lua require('vscode').action('editor.action.moveLinesDownAction')<cr>")
map("x", "K", "<cmd>lua require('vscode').action('editor.action.moveLinesUpAction')<cr>")

map("n", "<leader>/", "<cmd>lua require('vscode').action('editor.action.commentLine')<cr>")
map("n", "<leader>fm", "<cmd>lua require('vscode').action('editor.action.formatDocument')<cr>")


-- lsp
map("n", "[d", "<cmd>lua require('vscode').action('editor.action.marker.prev')<cr>")
map("n", "]d", "<cmd>lua require('vscode').action('editor.action.marker.next')<cr>")
map("n", "gd", "<cmd>lua require('vscode').action('editor.action.revealDefinition')<cr>")
map("n", "gr", "<cmd>lua require('vscode').action('editor.action.referenceSearch.trigger')<cr>")
map("n", "gI", "<cmd>lua require('vscode').action('editor.action.goToImplementation')<cr>")
map("n", "gt", "<cmd>lua require('vscode').action('editor.action.goToTypeDefinition')<cr>")
map("n", "<leader>rn", "<cmd>lua require('vscode').action('editor.action.rename')<cr>")
map("n", "<leader>gdt", "<cmd>lua require('vscode').action('errorLens.toggle')<cr>")
map("n", "K", "<cmd>lua require('vscode').action('editor.action.showHover')<cr>")


-- oil type shi
map("n", "-", function()
  require('vscode').action('workbench.action.toggleSidebarVisibility')
  require('vscode').action('workbench.files.action.focusFilesExplorer')
end)
map("n", "<C-b>", "<cmd>lua require('vscode').action('workbench.action.toggleSidebarVisibility')<cr>")

-- telescope type shi
map("n", "<leader>sf", "<cmd>lua require('vscode').action('find-it-faster.findFiles')<cr>")
map("n", "<leader>so", "<cmd>lua require('vscode').action('workbench.action.quickOpen')<cr>")
map("n", "<leader>sr", "<cmd>lua require('vscode').action('find-it-faster.resumeSearch')<cr>")
map("n", "<leader>sg", "<cmd>lua require('vscode').action('find-it-faster.findWithinFilesWithType')<cr>")
map("n", "<leader>ss", "<cmd>lua require('vscode').action('find-it-faster.findWithinFiles')<cr>")
map("n", "<leader>st", "<cmd>lua require('vscode').action('workbench.action.showCommands')<cr>")
map("n", "<leader>sb", "<cmd>lua require('vscode').action('workbench.action.showAllEditors')<cr>")
map("n", "<leader>sw", "<cmd>lua require('vscode').action('workbench.action.showAllSymbols')<cr>")

-- harpoon type shi
map("n", "<leader>h", "<cmd>lua require('vscode').action('workbench.action.openEditorAtIndex1')<cr>")
map("n", "<leader>j", "<cmd>lua require('vscode').action('workbench.action.openEditorAtIndex2')<cr>")
map("n", "<leader>k", "<cmd>lua require('vscode').action('workbench.action.openEditorAtIndex3')<cr>")
map("n", "<leader>l", "<cmd>lua require('vscode').action('workbench.action.openEditorAtIndex4')<cr>")


-- copilot
map("n", "<leader><leader>a", "<cmd>lua require('vscode').action('workbench.panel.chat.view.copilot.active')<cr>")
