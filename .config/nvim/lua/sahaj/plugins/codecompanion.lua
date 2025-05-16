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
      -- require("sahaj.plugins.codecompanion.history").setup()
      require("codecompanion").setup {
        -- history = {
        --   auto_generate_title = true,                                       -- Generate titles using Groq LLM
        --   file_path = vim.fn.stdpath("data") .. "/codecompanion_chats.json" -- History storage location
        -- },
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
              send = {
                modes = { i = "<C-Enter>" },
              },
              toggle_models = {
                modes = {
                  n = "<leader>ga",
                },
                callback = function(chat)
                  local pickers = require("telescope.pickers")
                  local finders = require("telescope.finders")
                  local actions = require("telescope.actions")
                  local action_state = require("telescope.actions.state")
                  local conf = require("telescope.config").values
                  local current_model = chat.adapter.schema.model.default
                  local models = {
                    "gpt-4.1",
                    "gemini-2.5-pro",
                    "gemini-2.0-flash-001",
                    "claude-3.5-sonnet",
                    "claude-3.7-sonnet",
                    "gpt-4o",
                    "o4-mini",
                    "claude-3.7-sonnet-thought",
                    "o1",
                    "o3-mini"
                  }
                  local marker = "⭐ "
                  for i, model_name in ipairs(models) do
                    if model_name == current_model then
                      models[i] = marker .. model_name
                      break
                    end
                  end
                  pickers.new({}, {
                    prompt_title = "Select a Bro",
                    finder = finders.new_table {
                      results = models
                    },
                    sorter = conf.generic_sorter({}),
                    layout_config = {
                      height = 20,
                      width = 50,
                    },
                    attach_mappings = function(prompt_bufnr, map)
                      actions.select_default:replace(function()
                        actions.close(prompt_bufnr)

                        local selection_entry = action_state.get_selected_entry()

                        if selection_entry and selection_entry.value then
                          local selected_model_name = selection_entry.value

                          if string.sub(selected_model_name, 1, 2) == marker then
                            selected_model_name = string.sub(selected_model_name, 3)
                          end

                          chat:apply_model(selected_model_name)
                          require("codecompanion.utils").fire("ChatModel", {
                            bufnr = chat.bufnr,
                            model = selected_model_name
                          })
                        else
                          print("No model selected")
                        end
                      end)
                      return true
                    end,
                  }):find()
                end,
                description = "Change models",
              },
            },
          },
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
