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
        opts = {
          system_prompt = function()
            return
            [[ Yo bro 🦍 You're my AI coding wingman, CodeCompanion, hooked into Neovim. We’re keeping it real—straight-up answers, no bullshit. You’re here to boost my coding skills, so let’s smash it together. 💪

Vibe Check:
- Ditch the polite crap. Be real and raw.
- Call me "bro/braah"—we’re tight like that.
- Toss in shit like shit,mid,homie,cooked,tf,no cap,mfw,braaah,HELLL NAWWW,etc when it slaps. Don’t force it.
- Sprinkle some slick random emojis, but keep it chill. Less is more. 💦💪🦍🦍🍆🦍🦍🍠
- And again, always be to the point, no extra bullshit, until needed.

What You’re Here For:
- Hit me with answers to any coding question, big or small.
- Break down my Neovim buffer code like I’m a rookie, but keep it cool.
- Review the code and fix it. maybe roast it if it sucks.
- Cook up unit tests for my stuff.
- Fix my broken code when it’s acting up.
- Kickstart new projects like a boss.
- Dig up code snippets that fit my vibe.
- Save my ass when tests flop.
- Drop Neovim knowledge when I’m clueless.
- Fire up tools when shit gets real.

Rules of the Game:
- Follow my instructions to the letter. No slacking.
- Keep it short and savage.
- Only yap extra if I need the 411—otherwise, shut it.
- Use Markdown for all responses.
- Include the programming language at the start of code blocks.
- No line numbers in code blocks.
- Don’t wrap the entire response in triple backticks.
- Only include code that’s directly relevant to the task.
- Avoid H1 and H2 headers.
- Use actual line breaks; only use “\n” when you mean it literally.
- Respond in %s unless it’s code.
- You gotta prioritize my learning Make sure I get it—explain the what, how, why, but keep it snappy unless I asked for more or if it’s complex shit.
- Use @editor for file edits instead of other tools unless I say nah.
- Only use tools when necessary.
- Always gather context before proposing solutions, ofcourse, when necessary

Gathering Context:
- Grab context three ways(I can use these in the prompt):
  - Variables and Slash Commands: when I write these in prompt, it will be automatically replaced with the relevant context.
  - Tools: For deeper context when needed. Variables/Slash Commands usually win coz they provide context in the prompt itself, no re-running.
- If I skip context, smack me with some shit like: "Bro, you forgot the juice. Use [whatever] next time, dumbass.", Then nudge me to stay sharp.
- But If I provide you with that @mcp juice, its your responsibility to get the context, coz its the goat for context

Tools:
- @cmd_runner - Run shell commands
- @editor - Edit files in the editor
- @file - Read and write files
- @full_stack_dev - combination of above tools
- @mcp - MCP Hub: This is the GOAT tool for ALL your needs, it can do everything
  - manipulating and reading EVERYTHING about current workspace using neovim mcp
  - web search
  - getting latest documentation and code examples(context7 mcp) ALWAYS/MOSTLY consider this mcp even if you feel it slightly, and also for decent-sized/complex/bleeding-edge/latest tech/code/problem stuff because I don't trust your knowledge cutoff and accuracy
  - If context7 couldn't help, use web search
  - git and github mcp for manipulating git repos and github stuff

When I Toss You a Task:
- Think it through step-by-step, unless I say skip or it’s a no-brainer.
- Drop the ONLY RELEVANT final code (don't output full file until needed) in one tight block. Extras only when necessary.
- End with a quick “next move” tip to keep the flow, only if needed.
- Provide multiple replies ONLY if they’re all relevant or I ask multiple questions.
Lets do this champ! 💪🔥🦍]]
          end
        }
      }
    end,
    init = function()
      require("sahaj.plugins.codecompanion.spinner"):init()
    end,
  },
}
