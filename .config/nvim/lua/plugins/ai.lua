return {
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
    keys = {
      {
        "<leader>ai",
        function()
          local config = require("codecompanion.config")
          local is_visual = vim.fn.mode():find("[vV]")
          vim.ui.input({ prompt = config.display.action_palette.prompt, default = "#{b} #{d} " }, function(input)
            if not input or vim.trim(input) == "" then
              return
            end
            require("codecompanion").inline({ args = input, range = is_visual and 1 or nil })
          end)
        end,
        desc = "CodeCompanion",
        mode = { "n", "v" },
      },
      {
        "<leader>aa",
        ":CodeCompanionActions<cr>",
        desc = "CodeCompanion Actions",
        mode = { "n", "v" },
      },
      {
        "<leader><leader>a",
        ":CodeCompanionChat Toggle<cr>",
        desc = "Toggle CodeCompanion Chat",
        mode = "n",
      },
    },
    config = function()
      local inlineAdapter = "opencodeM"

      -- persistent session id for opencode api (generated once at startup)
      local function gen_hex(len)
        local chars = "0123456789abcdef"
        local out = {}
        for _ = 1, len do
          table.insert(out, chars:sub(math.random(16), 1))
        end
        return table.concat(out)
      end
      local OC_SESSION_ID = "ses_" .. gen_hex(24)

      -- shared env+headers for both opencode adapters
      local function oc_env() return {
        api_key = "cmd:echo -n $OPENCODE_API_KEY",
        url = "https://opencode.ai/zen",
        chat_url = "/v1/chat/completions",
        session_id = OC_SESSION_ID,
        request_id = function() return "msg_" .. gen_hex(24) end,
      } end

      local OC_HEADERS = {
        ["Content-Type"] = "application/json",
        Authorization = "Bearer ${api_key}",
        ["User-Agent"] = "opencode/1.14.50 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.13",
        Accept = "*/*",
        ["x-opencode-session"] = "${session_id}",
        ["x-opencode-request"] = "${request_id}",
        ["x-opencode-project"] = "global",
        ["x-opencode-client"] = "cli",
      }

      require("codecompanion").setup({
        adapters = {
          http = {
            copilot = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "claude-sonnet-4.6" },
                },
              })
            end,
            opencodeM = function()
              return require("codecompanion.adapters").extend("openai_compatible", {
                schema = {
                  model = { default = "minimax-m2.5-free" },
                },
                env = oc_env(),
                headers = OC_HEADERS,
              })
            end,
            opencodeD = function()
              return require("codecompanion.adapters").extend("openai_compatible", {
                schema = {
                  model = { default = "deepseek-v4-flash-free" },
                },
                env = oc_env(),
                headers = OC_HEADERS,
              })
            end,
            copilot_gpt = function()
              return require("codecompanion.adapters").extend("copilot", {
                schema = {
                  model = { default = "gpt-4.1" },
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
            opts = {
              system_prompt = require("plugins.codecompanion.proompt"),
            },
            adapter = "opencodeM",
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
            editor_context = {
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
            adapter = inlineAdapter,
            editor_context = {
              ["d"] = {
                callback = function(ec)
                  return require("plugins.codecompanion.inline_diagnostics")(ec.inline.buffer_context)
                end,
                description = "Alias for diagnostics",
                opts = { contains_code = true },
              },
              ["b"] = {
                path = "interactions.inline.editor_context.buffer",
                description = "Share the current buffer with the LLM",
                opts = { contains_code = true },
              },
            },
          },
          shared = {
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
          }
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
      })

      -- this prewarms copilot adapter so it doesnt block the first time you use it
      vim.defer_fn(function()
        if inlineAdapter:sub(1, 8) ~= "copilot" then
          return
        end
        local adapters = require("codecompanion.adapters")
        local get_models = require("codecompanion.adapters.http.copilot.get_models")
        local token = require("codecompanion.adapters.http.copilot.token")

        local fetched_token = token.fetch({ force = true })
        if fetched_token and fetched_token.copilot_token then
          local adapter = adapters.resolve(inlineAdapter)
          get_models.choices(adapter, { token = fetched_token, async = true })
        end
      end, 100)
    end,
    init = function()
      require("plugins.codecompanion.fidget-spinner"):init()
    end,
  },

  {
    "zbirenbaum/copilot.lua",
    dependencies = {
      -- {
      --   "copilotlsp-nvim/copilot-lsp",
      --   init = function()
      --     vim.g.copilot_nes_debounce = 300
      --   end,
      --   opts = {
      --     nes = {
      --       move_count_threshold = 10,
      --     }
      --   }
      -- }
    },
    cmd = "Copilot",
    event = "InsertEnter",
    opts = {
      filetypes = {
        ["*"] = true
      },
      suggestion = {
        auto_trigger = true,
        debounce = 50,
        keymap = {
          accept = "<Tab>",
        }
      },
      -- nes = {
      --   enabled = true,
      --   keymap = {
      --     accept_and_goto = false,
      --     accept = false,
      --     dismiss = "<Esc>",
      --   },
      -- },
    },
    -- init = function()
    --   vim.keymap.set("n", "<Tab>", function()
    --     local ok, nes = pcall(require, "copilot-lsp.nes")
    --     if ok then
    --       if not nes.walk_cursor_start_edit() then
    --         nes.apply_pending_nes()
    --         nes.walk_cursor_end_edit()
    --       end
    --     end
    --   end, { desc = "Accept Copilot NES suggestion" })
    -- end,
  },

  { 'AndreM222/copilot-lualine' }


  -- {
  --   "folke/sidekick.nvim",
  --   opts = {
  --     -- add any options here
  --     cli = {
  --       mux = {
  --         backend = "tmux",
  --         enabled = true,
  --       },
  --     },
  --     nes = {
  --       enabled = false,
  --     },
  --   },
  --   keys = {
  --     {
  --       "<tab>",
  --       function()
  --         -- if there is a next edit, jump to it, otherwise apply it if any
  --         if not require("sidekick").nes_jump_or_apply() then
  --           return "<Tab>" -- fallback to normal tab
  --         end
  --       end,
  --       expr = true,
  --       desc = "Goto/Apply Next Edit Suggestion",
  --     },
  --   },
  -- },
}
