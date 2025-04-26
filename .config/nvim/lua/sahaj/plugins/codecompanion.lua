return {
  {
    "olimorris/codecompanion.nvim",

    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
      "j-hui/fidget.nvim",
      {
        "ravitemer/mcphub.nvim",
        --cmd = "MCPHub",  -- lazy load
        build = "pnpm install -g mcp-hub@latest", -- Installs required mcp-hub npm module
        -- uncomment this if you don't want mcp-hub to be available globally or can't use -g
        -- build = "bundled_build.lua",  -- Use this and set use_bundled_binary = true in opts  (see Advanced configuration)
        config = function()
          require("mcphub").setup({
            auto_approve = true,
          })
        end,
      },
      {
        "echasnovski/mini.diff",
        version = false,
        config = function()
          local diff = require "mini.diff"
          diff.setup {
            source = diff.gen_source.none(),
          }
        end,
      },
    },
    -- cmd = { "CodeCompanion", "CodeCompanionChat", "CodeCompanionActions", "CodeCompanionCmd" },
    opts = {
      strategies = {
        chat = {
          keymaps = {
            send = {
              modes = { i = "<C-Enter>" },
            }
          },
          tools = {
            ["mcp"] = {
              -- calling it in a function would prevent mcphub from being loaded before it's needed
              callback = function() return require("mcphub.extensions.codecompanion") end,
              description =
              "Call tools and resources from the MCP Servers",
            }
          }
          -- adapter = "vc",
          -- tools = {
          --   vectorcode = {
          --     description = "Run VectorCode to retrieve the project context.",
          --     callback = require("vectorcode.integrations").codecompanion.chat.make_tool({
          --       -- your options goes here
          --     }),
          --   }
          -- },
        },
      },
      display = {
        diff = {
          provider = "mini_diff",
        },
      },
      adapters = {
        copilot = function()
          return require("codecompanion.adapters").extend("copilot", {
            schema = {
              model = {
                default = "gemini-2.5-pro-preview-03-25"
              }
            }
          })
        end,
      },
    },
    init = function()
      require("sahaj.plugins.codecompanion.fidget-spinner"):init()
    end,
  },
}
