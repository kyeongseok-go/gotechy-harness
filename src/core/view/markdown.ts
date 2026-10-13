// HANDOFF 본문 Markdown을 HTML로. 원시 HTML은 글자로 이스케이프하고, 링크는 http(s)만 살린다(contract.md 8.2절).
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: false, typographer: false })
// 이미지는 외부 요청(추적 픽셀)이 되므로 만들지 않는다
md.disable('image')
// markdown-it 15에서 validateLink는 prototype 메서드다. 인스턴스 속성으로 덮어쓴다(M2b 실험으로 확인).
md.validateLink = (url: string) => /^https?:\/\//i.test(url.trim())

const renderLinkOpen = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  if (token) {
    token.attrSet('rel', 'noopener noreferrer')
    token.attrSet('target', '_blank')
  }
  return renderLinkOpen
    ? renderLinkOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}

export function renderMarkdown(src: string): string {
  return md.render(src)
}
