return {
  {
    "nvim-treesitter/nvim-treesitter",
    branch = "main",
    dependencies = { { "nvim-treesitter/nvim-treesitter-textobjects", branch = "main" } },
    event = { "BufReadPre", "BufNewFile" },
    lazy = false,
    build = ":TSUpdate",
    config = function()
      local treesitter = require("nvim-treesitter")
      treesitter.setup({})
      local parsers = {
        "javascript",
        "typescript",
        "tsx",
        "jsx",
        "html",
        "css",
        "markdown",
        "markdown_inline",
        "bash",
        "lua",
        "vim",
        "dockerfile",
        "gitignore",
        "vimdoc",
        "query",
        "python",
        "c",
        "cpp",
        "go",
      }
      treesitter.install(parsers)
      local filetypes = {}
      for _, parser in ipairs(parsers) do
        local ft = vim.treesitter.language.get_lang(parser)
        if ft == "tsx" then
          ft = "typescriptreact"
        elseif ft == "jsx" then
          ft = "javascriptreact"
        end
        table.insert(filetypes, ft)
      end
      vim.api.nvim_create_autocmd("FileType", {
        pattern = filetypes,
        callback = function()
          vim.treesitter.start()
        end,
      })

      require("nvim-treesitter-textobjects").setup({
        select = {
          lookahead = true,
        },
      });

      vim.keymap.set({ "x", "o" }, "af", function()
        require "nvim-treesitter-textobjects.select".select_textobject("@function.outer", "textobjects")
      end)
      vim.keymap.set({ "x", "o" }, "if", function()
        require "nvim-treesitter-textobjects.select".select_textobject("@function.inner", "textobjects")
      end)
      vim.keymap.set({ "x", "o" }, "ac", function()
        require "nvim-treesitter-textobjects.select".select_textobject("@class.outer", "textobjects")
      end)
      vim.keymap.set({ "x", "o" }, "ic", function()
        require "nvim-treesitter-textobjects.select".select_textobject("@class.inner", "textobjects")
      end)
      -- You can also use captures from other query groups like `locals.scm`
      vim.keymap.set({ "x", "o" }, "as", function()
        require "nvim-treesitter-textobjects.select".select_textobject("@local.scope", "locals")
      end)
    end
  }
}
