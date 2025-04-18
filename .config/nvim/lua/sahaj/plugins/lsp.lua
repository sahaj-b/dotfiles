return {
  {
    'neovim/nvim-lspconfig',
    dependencies = {
      'williamboman/mason.nvim',
      'williamboman/mason-lspconfig.nvim',
      -- 'WhoIsSethDaniel/mason-tool-installer.nvim',
      'saghen/blink.cmp',

    },
    opts = {
      servers = {
        bashls = {},
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
        -- pylsp = {
        --   settings = {
        --     pylsp = {
        --       plugins = {
        --         pycodestyle = {
        --           -- ignore = { '' },
        --           maxLineLength = 140
        --         },
        --         mccabe = {
        --           threshold = 50
        --         },
        --         -- jedi_completion = { include_params = true },
        --         -- jedi_hover = { enabled = true },
        --         -- jedi_references = { enabled = true },
        --         -- jedi_signature_help = { enabled = true },
        --         -- jedi_symbols = { enabled = true }
        --       }
        --     }
        --   }
        -- },

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
    },
    config = function(_, opts)
      local lspconfig = require('lspconfig')

      lspconfig.qmlls.setup({
        cmd = {
          "qmlls6",
        },
      })

      -- blink capabilities
      for server, config in pairs(opts.servers) do
        config.capabilities = require('blink.cmp').get_lsp_capabilities(config.capabilities)
        lspconfig[server].setup(config)
      end

      --  You can press `g?` for help in this menu.
      require('mason').setup()

      local ensure_installed = vim.tbl_keys(opts.servers or {})

      require('mason-lspconfig').setup { ensure_installed = ensure_installed }

      require('mason-lspconfig').setup {
        handlers = {
          function(server_name)
            local server = opts.servers[server_name] or {}
            server.capabilities = vim.tbl_deep_extend('force', {}, opts.servers[server_name].capabilities,
              server.capabilities or {})
            lspconfig[server_name].setup(server)
          end,
        },
      }

      -- DIAGNOSTICS

      vim.diagnostic.config({

        underline = {
          severity = { min = vim.diagnostic.severity.ERROR }
        },

        virtual_text = {
          severity = { min = vim.diagnostic.severity.WARN },
          -- prefix = '●'
          prefix = '•'
        },

        signs = {
          text = {
            [vim.diagnostic.severity.INFO] = '▍',
            [vim.diagnostic.severity.ERROR] = '▍',
            [vim.diagnostic.severity.WARN] = '▍',
            [vim.diagnostic.severity.HINT] = '▍',
          },
          linehl = {
            [vim.diagnostic.severity.INFO] = 'DiagnosticSignInfo',
            [vim.diagnostic.severity.ERROR] = 'DiagnosticSignError',
            [vim.diagnostic.severity.WARN] = 'DiagnosticSignWarn',
            [vim.diagnostic.severity.HINT] = 'DiagnosticSignHint',
          },
          numhl = {
            [vim.diagnostic.severity.INFO] = 'DiagnosticSignInfo',
            [vim.diagnostic.severity.ERROR] = 'DiagnosticSignError',
            [vim.diagnostic.severity.WARN] = 'DiagnosticSignWarn',
            [vim.diagnostic.severity.HINT] = 'DiagnosticSignHint',
          },
        },
        float = {
          border = 'rounded',
        }
      })
    end,
  },
}
