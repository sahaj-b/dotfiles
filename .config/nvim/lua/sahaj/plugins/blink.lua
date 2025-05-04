-- local trigger_text = ",,"
return {
  {
    'saghen/blink.cmp',
    dependencies = { 'rafamadriz/friendly-snippets',
      -- 'Kaiser-Yang/blink-cmp-avante',
    },
    version = '1.*',
    opts = {
      enabled = function() return vim.g.blink_cmp ~= false end,
      -- All presets have the following mappings:
      -- C-space: Open menu or open docs if already open
      -- C-n/C-p or Up/Down: Select next/previous item
      -- C-e: Hide menu
      -- C-k: Toggle signature help (if signature.enabled = true)
      -- :h blink-cmp-config-keymap
      keymap = {
        preset = 'default',
        ['<Up>'] = { 'select_prev', 'fallback' },
        ['<Down>'] = { 'select_next', 'fallback' },
        ['<C-space>'] = { 'accept', 'show' },
        ['<C-t>'] = { 'hide_signature', 'show_signature' },
        ['<C-u>'] = { 'scroll_documentation_up', 'show_documentation', 'fallback' },
        ['<C-d>'] = { 'scroll_documentation_down', 'show_documentation', 'fallback' },
      },
      appearance = { nerd_font_variant = 'mono' },
      signature = { enabled = true, trigger = { show_on_trigger_character = false, show_on_insert_on_trigger_character = false }, window = { show_documentation = false } },
      sources = {
        -- default = { 'avante', 'lsp', 'path', 'buffer' },
        providers = {
          -- avante = {
          --   module = 'blink-cmp-avante',
          --   name = 'Avante',
          --   opts = {
          --     -- options for blink-cmp-avante
          --   }
          -- }
          -- snippets = {
          --   name = "snippets",
          --   enabled = false,
          --   max_items = 15,
          --   min_keyword_length = 2,
          --   module = "blink.cmp.sources.snippets",
          --   score_offset = 85, -- the higher the number, the higher the priority
          --   -- Only show snippets if I type the trigger_text characters, so
          --   -- to expand the "bash" snippet, if the trigger_text is ";" I have to
          --   should_show_items = function()
          --     local col = vim.api.nvim_win_get_cursor(0)[2]
          --     local before_cursor = vim.api.nvim_get_current_line():sub(1, col)
          --     -- NOTE: remember that `trigger_text` is modified at the top of the file
          --     return before_cursor:match(trigger_text .. "%w*$") ~= nil
          --   end,
          --   -- After accepting the completion, delete the trigger_text characters
          --   -- from the final inserted text
          --   -- Modified transform_items function based on suggestion by `synic` so
          --   -- that the luasnip source is not reloaded after each transformation
          --   -- https://github.com/linkarzu/dotfiles-latest/discussions/7#discussion-7849902
          --   -- NOTE: I also tried to add the ";" prefix to all of the snippets loaded from
          --   -- friendly-snippets in the luasnip.lua file, but I was unable to do
          --   -- so, so I still have to use the transform_items here
          --   -- This removes the ";" only for the friendly-snippets snippets
          --   transform_items = function(_, items)
          --     local line = vim.api.nvim_get_current_line()
          --     local col = vim.api.nvim_win_get_cursor(0)[2]
          --     local before_cursor = line:sub(1, col)
          --     local start_pos, end_pos = before_cursor:find(trigger_text .. "[^" .. trigger_text .. "]*$")
          --     if start_pos then
          --       for _, item in ipairs(items) do
          --         if not item.trigger_text_modified then
          --           ---@diagnostic disable-next-line: inject-field
          --           item.trigger_text_modified = true
          --           item.textEdit = {
          --             newText = item.insertText or item.label,
          --             range = {
          --               start = { line = vim.fn.line(".") - 1, character = start_pos - 1 },
          --               ["end"] = { line = vim.fn.line(".") - 1, character = end_pos },
          --             },
          --           }
          --         end
          --       end
          --     end
          --     return items
          --   end,
          -- },
        }
      }
    },
    opts_extend = { "sources.default" }
  }
}
