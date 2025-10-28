return {
  {
    'neovim/nvim-lspconfig',
    config = function()
      local servers = {
        jsonls = {},
        glslls = { -- GLSL-specific settings
          settings = {
            glsl = {
              dialect = "glsl", -- Options: "glsl" (default/OpenGL), "glsl450", "essl" (ES), "hlsl", "msl", "spirv" (Vulkan)
              -- extendedDialect = "GLSL_450",  -- Uncomment for Vulkan/GLSL 4.50
            },
          },
        },
        biome = {},
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
            -- "--style={AllowShortBlocksOnASingleLine: Always, AllowShortIfStatementsOnASingleLine: WithoutElse}"
            -- "--fallback-style=\"{'ColumnLimit': '1000'}\"",
            -- "--fallback-style={BasedOnStyle: Google, ColumnLimit: 1000, AllowShortBlocksOnASingleLine: Always, AllowShortIfStatementsOnASingleLine: WithoutElse}",
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
  },
}
