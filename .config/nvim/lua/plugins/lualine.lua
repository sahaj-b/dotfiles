return {
  {
    'nvim-lualine/lualine.nvim',
    config = function()
      local lualine = require('lualine')
      local NESStatus = {
        function()
          local Nes = require("sidekick.nes")
          if next(Nes._requests) then
            return "󰗮" -- loading (waiting on API)
          end
          if Nes.have() then
            return " "
          end
          return " "
        end,
        color = function()
          local Nes = require("sidekick.nes")
          if next(Nes._requests) then
            return "DiagnosticWarn"
          end
        end,
        cond = function()
          if not require("sidekick.nes").enabled then
            return false
          end
          return true
        end,
      }
      local copilot = {
        function()
          return " "
        end,
        color = function()
          local status = require("sidekick.status").get()
          if status then
            return status.kind == "Error" and "DiagnosticError" or status.busy and "DiagnosticWarn" or "Special"
          end
        end,
        cond = function()
          local status = require("sidekick.status")
          return status.get() ~= nil
        end,
      }
      lualine.setup {
        options = {
          globalstatus = true,
          theme = 'auto',
          component_separators = { left = '', right = '' },
          section_separators = { left = '', right = '' },
        },
        sections = {

          lualine_a = { 'branch' },
          lualine_b = { { "filename", new_file = true, path = 4, shorting_target = 40 },
            -- macro
          },
          lualine_c = { 'diagnostics',
          },
          -- lualine_x = { spinner, 'diff', 'filetype' },
          lualine_x = { 'diff', 'filetype', NESStatus, copilot },
          -- lualine_y = { function() return "{.}%3{codeium#GetStatusString()}" end, 'progress' },
          lualine_y = { 'progress' },
          lualine_z = { 'location' }
        },
      }

      -- local function show_macro_recording()
      --   local recording_register = vim.fn.reg_recording()
      --   if recording_register == "" then
      --     return ""
      --   else
      --     return "Recording @" .. recording_register
      --   end
      -- end
      -- local spinner = require("plugins.codecompanion.lualine-spinner")

      -- show_macro_recording,
      -- color = function()
      --   local mode = vim.o.termguicolors and "gui" or "cterm"
      --   local code = vim.fn.synIDattr(
      --     vim.fn.synIDtrans(vim.fn.hlID("constant")),
      --     "fg",
      --     mode
      --   )
      --   return { fg = code, gui = "bold" }
      -- end,
      -- }
      -- vim.api.nvim_create_autocmd("RecordingEnter", {
      --   callback = function()
      --     lualine.refresh({
      --       place = { "statusline" },
      --     })
      --   end,
      -- })
      --
      -- vim.api.nvim_create_autocmd("RecordingLeave", {
      --   callback = function()
      --     local timer = vim.loop.new_timer()
      --     timer:start(
      --       50,
      --       0,
      --       vim.schedule_wrap(function()
      --         lualine.refresh({
      --           place = { "statusline" },
      --         })
      --       end)
      --     )
      --   end,
      -- })
    end
  }
}
