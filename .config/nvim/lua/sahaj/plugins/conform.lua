return {

  {
    'stevearc/conform.nvim',
    opts = {
      notify_on_error = true,
      format_on_save = function(bufnr)
        -- Disable with a global or buffer-local variable
        if vim.g.disable_autoformat or vim.b[bufnr].disable_autoformat then
          return
        end
        return { timeout_ms = 800, lsp_format = "fallback" }
      end,

      vim.api.nvim_create_user_command("ConformToggle", function(args)
        if args.bang then
          -- FormatDisable! will disable formatting just for this buffer
          vim.b.disable_autoformat = not vim.b.disable_autoformat
        else
          vim.g.disable_autoformat = not vim.g.disable_autoformat
        end
      end, {
        desc = "Toggle autoformat-on-save",
        bang = true,
      }),
      formatters_by_ft = {
        cpp = { 'clangd' },
        c = { 'clangd' },
        sh = { 'shfmt' },
        json = { 'prettierd' },
        jsonc = { 'prettierd' },
        javascript = { 'prettierd' },
        typescript = { 'prettierd' },
        html = { 'prettierd' },
        javascriptreact = { 'prettierd' },
        typescriptreact = { 'prettierd' },
        -- javascriptreact = { 'prettier' },
        -- typescriptreact = { 'prettier' },
        css = { 'prettierd' },
        python = { 'ruff' },
        sql = { 'sql_formatter' },
      }
      -- Conform can also run multiple formatters sequentially
      -- python = { "isort", "black" },
      --
      -- You can use a sub-list to tell conform to run *until* a formatter
      -- is found.
      -- javascript = { { "prettierd", "prettier" } },
      -- },
    },
  },
}
