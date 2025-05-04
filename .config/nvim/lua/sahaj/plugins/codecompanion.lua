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
    cmd = { "CodeCompanion", "CodeCompanionChat", "CodeCompanionActions", "CodeCompanionCmd" },
    config = function()
      -- require("sahaj.plugins.codecompanion.history").setup()
      require("codecompanion").setup {
        -- history = {
        --   auto_generate_title = true,                                       -- Generate titles using Groq LLM
        --   file_path = vim.fn.stdpath("data") .. "/codecompanion_chats.json" -- History storage location
        -- },
        extensions = {
          mcphub = {
            callback = "mcphub.extensions.codecompanion",
            opts = {
              auto_submit_success = true,
              auto_submit_errors = false,
              make_vars = true,
              make_slash_commands = true,
              show_result_in_chat = true,
            },
          },
        },
        strategies = {
          chat = {
            variables = {
              ["mkcontext"] = {
                callback = function()
                  local handle = io.popen("mkcontext")
                  if handle then
                    local result = handle:read("*a")
                    handle:close()
                    return result
                  else
                    return "Failed to run mkcontext command"
                  end
                end,
                description = "Get the output of mkcontext command (gives the tree structure and all the files' content in current directory)",
                opts = {
                  contains_code = false,
                },
              },
            },
            keymaps = {
              send = {
                modes = { i = "<C-Enter>" },
              }
            },
          },
        },
        display = {
          chat = {
            auto_scroll = false,
          },
          diff = {
            provider = "mini_diff",
          },
        },
        adapters = {
          copilot = function()
            return require("codecompanion.adapters").extend("copilot", {
              schema = {
                model = {
                  default = "gpt-4.1"
                }
              }
            })
          end,
          gemini = function()
            return require("codecompanion.adapters").extend("gemini", {
              env = {
                api_key = "cmd:echo -n $GOOGLE_API_KEY",
              },
              -- schema = {
              --   model = {
              --     default = "gemini-2.5-flash",
              --   }
              -- }
            })
          end,
        },
        opts = { system_prompt = require("sahaj.plugins.codecompanion.proompt") }
      }
    end,
    init = function()
      require("sahaj.plugins.codecompanion.fidget-spinner"):init()
    end,
  },
}
