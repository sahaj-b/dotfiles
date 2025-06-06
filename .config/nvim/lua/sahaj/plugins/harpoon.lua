return { {
  'theprimeagen/harpoon',
  branch = "harpoon2",
  -- lazy = true,
  config = function()
    local harpoon = require("harpoon")
    harpoon:setup({
      global_settings = {
        tabline = true,
        tabline_prefix = "   ",
        tabline_suffix = "   ",
      }
    })
    vim.keymap.set("n", "<leader>ra", function() harpoon:list():add() end)
    vim.keymap.set("n", "<leader>e", function() harpoon.ui:toggle_quick_menu(harpoon:list()) end)
    vim.keymap.set("n", "<leader>h", function() harpoon:list():select(1) end)
    vim.keymap.set("n", "<leader>j", function() harpoon:list():select(2) end)
    vim.keymap.set("n", "<leader>k", function() harpoon:list():select(3) end)
    vim.keymap.set("n", "<leader>l", function() harpoon:list():select(4) end)
    vim.keymap.set("n", "<C-1>", function() harpoon:list():select(5) end)
    vim.keymap.set("n", "<C-2>", function() harpoon:list():select(6) end)
    vim.keymap.set("n", "<C-3>", function() harpoon:list():select(7) end)
    vim.keymap.set("n", "<C-4>", function() harpoon:list():select(8) end)

    harpoon:extend({
      UI_CREATE = function(cx)
        vim.keymap.set("n", "<C-v>", function()
          harpoon.ui:select_menu_item({ vsplit = true })
        end, { buffer = cx.bufnr })

        vim.keymap.set("n", "<C-x>", function()
          harpoon.ui:select_menu_item({ split = true })
        end, { buffer = cx.bufnr })

        vim.keymap.set("n", "<C-t>", function()
          harpoon.ui:select_menu_item({ tabedit = true })
        end, { buffer = cx.bufnr })
      end,
    })

    local harpoon_extensions = require("harpoon.extensions")
    harpoon:extend(harpoon_extensions.builtins.highlight_current_file())
  end
}
}
