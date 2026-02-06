return {
  {
    "folke/sidekick.nvim",
    opts = {
      -- add any options here
      cli = {
        mux = {
          backend = "tmux",
          enabled = true,
        },
      },
      nes = {
        enabled = false,
      },
    },
    keys = {
      {
        "<tab>",
        function()
          -- if there is a next edit, jump to it, otherwise apply it if any
          if not require("sidekick").nes_jump_or_apply() then
            return "<Tab>" -- fallback to normal tab
          end
        end,
        expr = true,
        desc = "Goto/Apply Next Edit Suggestion",
      },
    },
  },
  {
    "olimorris/codecompanion.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "ravitemer/codecompanion-history.nvim",
      -- {
      --   "ravitemer/mcphub.nvim",
      --   build = "pnpm install -g mcp-hub@latest",
      --   config = function()
      --     require("mcphub").setup({ auto_approve = true })
      --   end,
      -- },
      {
        "echasnovski/mini.diff",
        version = false,
        config = function()
          require("mini.diff").setup({
            source = require("mini.diff").gen_source.none(),
          })
        end,
      },
    },
    cmd = { "CodeCompanion", "CodeCompanionChat", "CodeCompanionActions", "CodeCompanionCmd", "CodeCompanionHistory" },
    config = function()
      require("codecompanion").setup({
        adapters = {
          http = {
            copilot = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "claude-sonnet-4.5" },
                },
              })
            end,
            copilot_sonnet = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "claude-sonnet-4.5" },
                },
              })
            end,
            copilot_gpt = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "gpt-4.1" },
                },
              })
            end,
            copilot_gpt5 = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "gpt-5-mini" },
                },
              })
            end,
            copilot_opus = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "claude-opus-4.5" },
                },
              })
            end,
            gemini = function()
              return require("codecompanion.adapters").extend("gemini", {
                env = {
                  api_key = "cmd:echo -n $GOOGLE_API_KEY",
                },
              })
            end,
          },
        },

        interactions = {
          chat = {
            adapter = "copilot",
            tools = {
              ["insert_edit_into_file"] = {
                opts = {
                  requires_approval = {
                    buffer = false,
                    file = true,
                  },
                  user_confirmation = false,
                },
              },
            },
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
                description =
                "Get the output of mkcontext command (gives the tree structure and all the files' content in current directory)",
                opts = {
                  contains_code = false,
                },
              },
            },
          },
          inline = {
            adapter = "copilot_gpt",
            keymaps = {
              accept_change = {
                modes = { n = "ga" },
                description = "Accept the suggested change",
              },
              reject_change = {
                modes = { n = "gr" },
                opts = { nowait = true },
                description = "Reject the suggested change",
              },
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

        extensions = {
          history = {
            enabled = true,
            opts = {
              keymap = "gh",
              auto_generate_title = true,
              continue_last_chat = false,
              delete_on_clearing_chat = true,
              dir_to_save = vim.fn.stdpath("data") .. "/codecompanion-history",
            },
          },
        },

        prompt_library = {
          default = {
            strategy = "chat",
            description = "Default chat prompt",
            opts = {
              -- If your proompt() returns a string/table, use it here:
              system_prompt = require("plugins.codecompanion.proompt"),
              -- or if proompt is a markdown file/string:
              -- system_prompt = function() return require("plugins.codecompanion.proompt") end,
            },
          },
        },
      })
    end,
    init = function()
      require("plugins.codecompanion.fidget-spinner"):init()
    end,
  },
}
