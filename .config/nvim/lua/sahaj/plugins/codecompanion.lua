return {
  {
    "olimorris/codecompanion.nvim",

    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
      "ravitemer/codecompanion-history.nvim",
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
    cmd = { "CodeCompanion", "CodeCompanionChat", "CodeCompanionActions", "CodeCompanionCmd", "CodeCompanionHistory" },
    config = function()
      require("codecompanion").setup {
        extensions = {
          history = {
            enabled = true,
            opts = {
              keymap = "gh",
              auto_generate_title = true,
              continue_last_chat = false,
              delete_on_clearing_chat = true,
              dir_to_save = vim.fn.stdpath("data") .. "/codecompanion-history",
            }
          },
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
              toggle_models = {
                modes = {
                  n = "<leader>ga",
                },
                callback = require("sahaj.plugins.codecompanion.model_picker"),
                description = "Change models",
              },
            },
          },
          inline = { adapter = "copilot_o3" },
        },
        display = {
          chat = {
            auto_scroll = false,
            -- show_settings = true
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
          copilot_o3 = function()
            return require("codecompanion.adapters").extend("copilot", {
              schema = {
                model = {
                  default = "o3-mini"
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
