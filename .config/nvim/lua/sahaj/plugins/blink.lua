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
      keymap = {
        preset = 'default',
        ['<Up>'] = { 'select_prev', 'fallback' },
        ['<Down>'] = { 'select_next', 'fallback' },
        ['<C-space>'] = { 'accept', 'show' },
        ['<C-t>'] = { 'hide_signature', 'show_signature' },
        ['<C-u>'] = { 'scroll_documentation_up', 'show_documentation', 'fallback' },
        ['<C-d>'] = { 'scroll_documentation_down', 'show_documentation', 'fallback' },
      },
      completion = { documentation = { auto_show = true } },
      appearance = { nerd_font_variant = 'mono' },
      signature = { enabled = true, trigger = { show_on_trigger_character = false, show_on_insert_on_trigger_character = false }, window = { show_documentation = false } },
    },
    opts_extend = { "sources.default" }
  }
}
