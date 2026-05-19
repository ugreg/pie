#!/bin/bash
# Embed font as base64 in styles.css

FONT="css/CaskaydiaMonoNerdFontMono-Regular.ttf"
CSS="css/styles.css"

if [ ! -f "$FONT" ]; then
  echo "Error: Font file not found at $FONT"
  exit 1
fi

# Generate base64
B64=$(base64 -i "$FONT" | tr -d '\n')

# Create new CSS with embedded font
cat > "$CSS" << EOF
@font-face {
  font-family: 'CaskaydiaMonoNerdFont';
  src: url(data:font/ttf;charset=utf-8;base64,$B64) format('truetype');
  font-weight: normal;
  font-style: normal;
}

.nerd-diagram {
  font-family: 'CaskaydiaMonoNerdFont', monospace;
  font-size: 14px;
  line-height: 1.2;
  white-space: pre;
  display: block;
  margin: 20px 0;
  text-align: center;
}
EOF

echo "Font embedded in $CSS"
echo "Base64 size: $(wc -c < "$CSS") bytes"
