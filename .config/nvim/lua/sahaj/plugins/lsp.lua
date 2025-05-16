return {
  {
    'neovim/nvim-lspconfig',
    config = function()
      local servers = {
        gopls = {
          settings = {
            gopls = {
              gofumpt = true
            }
          }
        },
        ruff = {},
        bashls = {},
        shellcheck = {},
        pyright = {},
        ts_ls = {},
        tailwindcss = {},
        clangd = {
          cmd = {
            "clangd",
            -- "--fallback-style=\"{'ColumnLimit': '1000'}\"",
          },
          capabilities = {
            textDocument = {
              completion = {
                completionItem = {
                  snippetSupport = false,
                },
              },
            },
          },
        },

        lua_ls = {
          settings = {
            Lua = {
              completion = {
                callSnippet = 'Replace',
              },
              diagnostics = {
                disable = { 'missing-fields' },
                globals = { 'vim' }
              },
            },
          },
        },
      }

      -- LSPs
      for name, cfg in pairs(servers) do
        vim.lsp.config[name] = cfg
      end
      vim.lsp.enable(vim.tbl_keys(servers))

      -- DIAGNOSTICS
      vim.diagnostic.config({
        virtual_text = {
          severity = { min = vim.diagnostic.severity.WARN },
          prefix = '•'
        },
        signs = {
          text = {
            [vim.diagnostic.severity.INFO] = '▍',
            [vim.diagnostic.severity.ERROR] = '▍',
            [vim.diagnostic.severity.WARN] = '▍',
            [vim.diagnostic.severity.HINT] = '▍',
          },
        },
        float = {
          border = 'rounded',
        }
      })
    end,
  }
  ,
}
