return {

  {
    'stevearc/conform.nvim',
    config = function()
      local conform = require('conform')
      local util = require('conform.util')
      conform.setup {
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
        log_level = vim.log.levels.DEBUG,
        formatters = {
          ["biome-tailwind"] = {
            command = "biome",
            args = { "lint", "--fix", "--only=nursery/useSortedClasses", "--stdin-file-path", "$FILENAME" },
            stdin = true,
            description = "biome tailwind classes sorter",
          },
          ["biome-assist"] = {
            command = util.from_node_modules("biome"),
            stdin = true,
            args = {
              "check",
              "--write",
              "--linter-enabled=false",
              "--assist-enabled=true",
              "--stdin-file-path",
              "$FILENAME",
            },
          },
          ["biome-assist-linter"] = {
            command = util.from_node_modules("biome"),
            stdin = true,
            args = {
              "check",
              "--write",
              "--linter-enabled=true",
              "--assist-enabled=true",
              "--stdin-file-path",
              "$FILENAME",
            },
          },
          ["biome-unsafe-linter"] = {
            command = util.from_node_modules("biome"),
            stdin = true,
            args = {
              "check",
              "--write",
              "--unsafe",
              "--linter-enabled=true",
              "--assist-enabled=true",
              "--stdin-file-path",
              "$FILENAME",
            },
          },
          ["prettierd-local"] = {
            command = util.from_node_modules("prettierd"),
            -- this is the marker for the git root repo, so that it doesn't search my home dir or smth
            cwd = util.root_file({
              "prettier.config.js",
              "prettier.config.ts",
              ".git",
            }),
            require_cwd = true,
          },

          ["prettier-local"] = {
            command = util.from_node_modules("prettier"),
            cwd = util.root_file({
              "prettier.config.js",
              "prettier.config.ts",
              ".git",
            }),
            require_cwd = true,
          },
        },
        formatters_by_ft = {
          cpp = { 'clangd' },
          c = { 'clangd' },
          sh = { 'shfmt' },
          python = { 'ruff' },
          sql = { 'sql_formatter' },
          html = { 'prettierd', 'prettier', stop_after_first = true },
          -- json = { 'fixjson' },
          -- jsonc = { 'fixjson' },
          css = { 'biome' },

          javascript = { "biome-assist", "prettierd", "prettier", stop_after_first = true },
          typescript = { "biome-assist", "prettierd", "prettier", stop_after_first = true },
          javascriptreact = { "biome-assist", "prettierd", "prettier", stop_after_first = true },
          typescriptreact = { "biome-assist", "prettierd", "prettier", stop_after_first = true },
        }
        -- run sequentially, optionally stop after first
        -- python = { "isort", "black", stop_after_first = true },
      }

      function Get_ts_formatter(bufnr)
        local dirname = vim.fs.dirname(vim.api.nvim_buf_get_name(bufnr))

        -- priority 1: prettierd
        if vim.fs.find("node_modules/.bin/prettierd", {
              upward = true,
              path = dirname,
              limit = 1
            })[1] then
          return { "prettierd" }
        end

        -- Second priority: prettier
        if vim.fs.find("node_modules/.bin/prettier", {
              upward = true,
              path = dirname,
              limit = 1
            })[1] then
          return { "prettier" }
        end

        -- Third priority: biome
        -- use biome-check if you wanna also apply 'safe' code actions
        if conform.get_formatter_info("biome", bufnr).available then
          return { "biome-assist" }
        end

        -- Fallback: global prettierd then prettier
        return { "prettierd", "prettier", stop_after_first = true }
      end
    end,
  },
}
