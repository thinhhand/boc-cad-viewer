import { AcApDocManager } from '@mlightcad/cad-simple-viewer'
import { AcDbDatabase, AcDbMText, AcDbText } from '@mlightcad/data-model'
import { FontManager } from '@mlightcad/mtext-renderer'

export type FontEncodingHint = 'tcvn3' | 'tcvn3_upper' | 'vni' | 'unicode' | undefined

// TCVN3 (ABC / .VnTime / vntime.shx / vnsimli.shx) -> Unicode mapping
export const TCVN3_MAP: Record<string, string> = {
  '\u00A1': 'Ă',
  '\u00A2': 'Â',
  '\u00A3': 'Ê',
  '\u00A4': 'Ô',
  '\u00A5': 'Ơ',
  '\u00A6': 'Ư',
  '\u00A7': 'Đ',
  '\u00A8': 'ă',
  '\u00A9': 'â',
  '\u00AA': 'ê',
  '\u00AB': 'ô',
  '\u00AC': 'ơ',
  '\u00AD': 'ư',
  '\u00AE': 'đ',
  '\u00B5': 'à',
  '\u00B6': 'ả',
  '\u00B7': 'ã',
  '\u00B8': 'á',
  '\u00B9': 'ạ',
  '\u00BA': 'ằ',
  '\u00BB': 'ẳ',
  '\u00BC': 'ẵ',
  '\u00BD': 'ắ',
  '\u00BE': 'ặ',
  '\u00C6': 'ầ',
  '\u00C7': 'ẩ',
  '\u00C8': 'ẫ',
  '\u00C9': 'ấ',
  '\u00CA': 'ậ',
  '\u00CB': 'è',
  '\u00CC': 'ẻ',
  '\u00CD': 'ẽ',
  '\u00CE': 'é',
  '\u00CF': 'ẹ',
  '\u00D0': 'ề',
  '\u00D1': 'ể',
  '\u00D2': 'ễ',
  '\u00D3': 'ế',
  '\u00D4': 'ệ',
  '\u00D5': 'ì',
  '\u00D6': 'ỉ',
  '\u00D7': 'ĩ',
  '\u00D8': 'í',
  '\u00D9': 'ị',
  '\u00DA': 'ò',
  '\u00DB': 'ỏ',
  '\u00DC': 'õ',
  '\u00DD': 'ó',
  '\u00DE': 'ọ',
  '\u00DF': 'ồ',
  '\u00E1': 'ổ',
  '\u00E2': 'ỗ',
  '\u00E3': 'ố',
  '\u00E4': 'ộ',
  '\u00E5': 'ờ',
  '\u00E6': 'ở',
  '\u00E7': 'ỡ',
  '\u00E8': 'ớ',
  '\u00E9': 'ợ',
  '\u00EA': 'ù',
  '\u00EB': 'ủ',
  '\u00EC': 'ũ',
  '\u00ED': 'ú',
  '\u00EE': 'ụ',
  '\u00EF': 'ừ',
  '\u00F1': 'ử',
  '\u00F2': 'ữ',
  '\u00F3': 'ứ',
  '\u00F4': 'ự',
  '\u00F5': 'ỳ',
  '\u00F6': 'ỷ',
  '\u00F7': 'ỹ',
  '\u00F8': 'ý',
  '\u00F9': 'ỵ',
}

// VNI-Windows -> Unicode mapping
export const VNI_VOWEL_MAP: Record<string, Record<string, string>> = {
  a: {
    '\u00F9': 'à', '\u00F8': 'ả', '\u00FB': 'ã', '\u00F5': 'á', '\u00EF': 'ạ',
    '\u00E2': 'â', '\u00E1': 'ầ', '\u00E0': 'ẩ', '\u00E5': 'ẫ', '\u00E3': 'ấ', '\u00E4': 'ậ',
    '\u00EA': 'ă', '\u00E9': 'ằ', '\u00E8': 'ẳ', '\u00EB': 'ẵ', '\u00EC': 'ắ', '\u00ED': 'ặ',
  },
  A: {
    '\u00F9': 'À', '\u00F8': 'Ả', '\u00FB': 'Ã', '\u00F5': 'Á', '\u00EF': 'Ạ',
    '\u00D9': 'À', '\u00D8': 'Ả', '\u00DB': 'Ã', '\u00D5': 'Á', '\u00CF': 'Ạ',
    '\u00E2': 'Â', '\u00E1': 'Ầ', '\u00E0': 'Ẩ', '\u00E5': 'Ẫ', '\u00E3': 'Ấ', '\u00E4': 'Ậ',
    '\u00C2': 'Â', '\u00C1': 'Ầ', '\u00C0': 'Ẩ', '\u00C5': 'Ẫ', '\u00C3': 'Ấ', '\u00C4': 'Ậ',
    '\u00EA': 'Ă', '\u00E9': 'Ằ', '\u00E8': 'Ẳ', '\u00EB': 'Ẵ', '\u00EC': 'Ắ', '\u00ED': 'Ặ',
    '\u00CA': 'Ă', '\u00C9': 'Ằ', '\u00C8': 'Ẳ', '\u00CB': 'Ẵ', '\u00CC': 'Ắ', '\u00CD': 'Ặ',
  },
  e: {
    '\u00F9': 'è', '\u00F8': 'ẻ', '\u00FB': 'ẽ', '\u00F5': 'é', '\u00EF': 'ẹ',
    '\u00EA': 'ê', '\u00E9': 'ề', '\u00E8': 'ể', '\u00EB': 'ễ', '\u00EC': 'ế', '\u00ED': 'ệ',
  },
  E: {
    '\u00F9': 'È', '\u00F8': 'Ẻ', '\u00FB': 'Ẽ', '\u00F5': 'É', '\u00EF': 'Ẹ',
    '\u00D9': 'È', '\u00D8': 'Ẻ', '\u00DB': 'Ẽ', '\u00D5': 'É', '\u00CF': 'Ẹ',
    '\u00EA': 'Ê', '\u00E9': 'Ề', '\u00E8': 'Ể', '\u00EB': 'Ễ', '\u00EC': 'Ế', '\u00ED': 'Ệ',
    '\u00CA': 'Ê', '\u00C9': 'Ề', '\u00C8': 'Ể', '\u00CB': 'Ễ', '\u00CC': 'Ế', '\u00CD': 'Ệ',
  },
  o: {
    '\u00F9': 'ò', '\u00F8': 'ỏ', '\u00FB': 'õ', '\u00F5': 'ó', '\u00EF': 'ọ',
    '\u00F4': 'ô', '\u00E2': 'ô', '\u00E1': 'ồ', '\u00E0': 'ổ', '\u00E5': 'ỗ', '\u00E3': 'ố', '\u00E4': 'ộ',
    '\u00F6': 'ơ', '\u00EA': 'ơ', '\u00E9': 'ờ', '\u00E8': 'ở', '\u00EB': 'ỡ', '\u00EC': 'ớ', '\u00ED': 'ợ',
  },
  O: {
    '\u00F9': 'Ò', '\u00F8': 'Ỏ', '\u00FB': 'Õ', '\u00F5': 'Ó', '\u00EF': 'Ọ',
    '\u00D9': 'Ò', '\u00D8': 'Ỏ', '\u00DB': 'Õ', '\u00D5': 'Ó', '\u00CF': 'Ọ',
    '\u00D4': 'Ô', '\u00F4': 'Ô', '\u00C2': 'Ô', '\u00C1': 'Ồ', '\u00C0': 'Ổ', '\u00C5': 'Ỗ', '\u00C3': 'Ố', '\u00C4': 'Ộ',
    '\u00D6': 'Ơ', '\u00F6': 'Ơ', '\u00CA': 'Ơ', '\u00C9': 'Ờ', '\u00C8': 'Ở', '\u00CB': 'Ỡ', '\u00CC': 'Ớ', '\u00CD': 'Ợ',
  },
  u: {
    '\u00F9': 'ù', '\u00F8': 'ủ', '\u00FB': 'ũ', '\u00F5': 'ú', '\u00EF': 'ụ',
    '\u00FC': 'ư', '\u00EA': 'ư', '\u00E9': 'ừ', '\u00E8': 'ử', '\u00EB': 'ữ', '\u00EC': 'ứ', '\u00ED': 'ự',
  },
  U: {
    '\u00F9': 'Ù', '\u00F8': 'Ủ', '\u00FB': 'Ũ', '\u00F5': 'Ú', '\u00EF': 'Ụ',
    '\u00D9': 'Ù', '\u00D8': 'Ủ', '\u00DB': 'Ũ', '\u00D5': 'Ú', '\u00CF': 'Ụ',
    '\u00DC': 'Ư', '\u00FC': 'Ư', '\u00CA': 'Ư', '\u00C9': 'Ừ', '\u00C8': 'Ử', '\u00CB': 'Ữ', '\u00CC': 'Ứ', '\u00CD': 'Ự',
  },
  i: {
    '\u00F9': 'ì', '\u00F8': 'ỉ', '\u00FB': 'ĩ', '\u00F5': 'í', '\u00EF': 'ị',
  },
  I: {
    '\u00F9': 'Ì', '\u00F8': 'Ỉ', '\u00FB': 'Ĩ', '\u00F5': 'Í', '\u00EF': 'Ị',
    '\u00D9': 'Ì', '\u00D8': 'Ỉ', '\u00DB': 'Ĩ', '\u00D5': 'Í', '\u00CF': 'Ị',
  },
  y: {
    '\u00F9': 'ỳ', '\u00F8': 'ỷ', '\u00FB': 'ỹ', '\u00F5': 'ý', '\u00EF': 'ỵ',
  },
  Y: {
    '\u00F9': 'Ỳ', '\u00F8': 'Ỷ', '\u00FB': 'Ỹ', '\u00F5': 'Ý', '\u00EF': 'Ỵ',
    '\u00D9': 'Ỳ', '\u00D8': 'Ỷ', '\u00DB': 'Ỹ', '\u00D5': 'Ý', '\u00CF': 'Ỵ',
  },
  '\u00F4': {
    '\u00E1': 'ồ', '\u00E0': 'ổ', '\u00E5': 'ỗ', '\u00E3': 'ố', '\u00E4': 'ộ',
  },
  '\u00D4': {
    '\u00E1': 'Ồ', '\u00E0': 'Ổ', '\u00E5': 'Ỗ', '\u00E3': 'Ố', '\u00E4': 'Ộ',
    '\u00C1': 'Ồ', '\u00C0': 'Ổ', '\u00C5': 'Ỗ', '\u00C3': 'Ố', '\u00C4': 'Ộ',
  },
  '\u00F6': {
    '\u00E9': 'ờ', '\u00E8': 'ở', '\u00EB': 'ỡ', '\u00EC': 'ớ', '\u00ED': 'ợ',
  },
  '\u00D6': {
    '\u00E9': 'Ờ', '\u00E8': 'Ở', '\u00EB': 'Ỡ', '\u00EC': 'Ớ', '\u00ED': 'Ợ',
    '\u00C9': 'Ờ', '\u00C8': 'Ở', '\u00CB': 'Ỡ', '\u00CC': 'Ớ', '\u00CD': 'Ợ',
  },
}

export const VNI_SINGLE_MAP: Record<string, string> = {
  '\u00D1': 'Đ',
  '\u00F1': 'đ',
  '\u00D4': 'Ô',
  '\u00F4': 'ô',
  '\u00D6': 'Ơ',
  '\u00F6': 'ơ',
  '\u00DC': 'Ư',
  '\u00FC': 'ư',
  '\u00E2': 'â',
  '\u00C2': 'Â',
  '\u00EA': 'ê',
  '\u00CA': 'Ê',
  '\u00F3': 'ó',
  '\u00D3': 'Ó',
  '\u00F2': 'ò',
  '\u00D2': 'Ò',
  '\u00E1': 'á',
  '\u00C1': 'Á',
  '\u00E0': 'à',
  '\u00C0': 'À',
  '\u00E9': 'é',
  '\u00C9': 'É',
  '\u00E8': 'è',
  '\u00C8': 'È',
  '\u00ED': 'í',
  '\u00CD': 'Í',
  '\u00EC': 'ì',
  '\u00CC': 'Ì',
  '\u00FA': 'ú',
  '\u00DA': 'Ú',
  '\u00F9': 'ù',
  '\u00D9': 'Ù',
}

const CP1252_REV: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
}

/**
 * Tự động phát hiện mã font tiếng Việt từ tên Style / Font trong CAD
 */
export function detectFontEncodingFromName(fontSpec: string): FontEncodingHint {
  if (!fontSpec) return undefined
  const f = fontSpec.toLowerCase()
  if (/(?:\.vn|vntime|vnarial|vnsimli|vnsimple|vn_tcvn|abc)/i.test(f)) {
    return /\.vn\w*h\b/i.test(f) ? 'tcvn3_upper' : 'tcvn3'
  }
  if (/(?:\bvni[-_ ]|\bvni\b|vni\.shx|vnitimes|vnihelve|vniaptima)/i.test(f)) {
    return 'vni'
  }
  return undefined
}

export function convertVniToUnicode(s: string): string {
  let out = ''
  const n = s.length
  for (let i = 0; i < n; i++) {
    const ch = s[i]
    const next = i + 1 < n ? s[i + 1] : ''
    const vMap = VNI_VOWEL_MAP[ch]
    if (vMap && next && vMap[next]) {
      out += vMap[next]
      i++
    } else if (VNI_SINGLE_MAP[ch]) {
      out += VNI_SINGLE_MAP[ch]
    } else {
      out += ch
    }
  }
  return out
}

export function convertTcvn3ToUnicode(s: string, forceUpper = false): string {
  return s.replace(/\S+/g, word => {
    let asciiUpper = 0
    let asciiLower = 0
    for (let i = 0; i < word.length; i++) {
      const c = word.charCodeAt(i)
      if (c >= 65 && c <= 90) asciiUpper++
      else if (c >= 97 && c <= 122) asciiLower++
    }
    const wordIsUpper = forceUpper || (asciiUpper >= 1 && asciiLower === 0)
    let out = ''
    for (let i = 0; i < word.length; i++) {
      const ch = word[i]
      const mapped = TCVN3_MAP[ch]
      if (mapped) {
        out += wordIsUpper ? mapped.toUpperCase() : mapped
      } else {
        out += ch
      }
    }
    return out
  })
}

export function tryFixUtf8Mojibake(s: string): string {
  if (!/(?:Ã[\u0080-\u00BF\u20AC-\u2122]|Ä[\u0080-\u00BF\u20AC-\u2122]|Æ[\u0080-\u00BF\u20AC-\u2122]|á»|áº)/.test(s)) {
    return s
  }
  try {
    const bytes = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i)
      if (code <= 0xff) {
        bytes[i] = code
      } else if (CP1252_REV[code] !== undefined) {
        bytes[i] = CP1252_REV[code]
      } else {
        return s
      }
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return s
  }
}

/**
 * Giải mã chuỗi ký tự CAD thành tiếng Việt Unicode chuẩn UTF-8
 */
export function decodeVietnameseCadText(raw: string, styleHint?: FontEncodingHint): string {
  if (!raw) return ''

  let fontHint: FontEncodingHint = styleHint
  const fontMatch = raw.match(/\\[fF]([^;|\\{}]+)/)
  if (fontMatch && fontMatch[1]) {
    const detected = detectFontEncodingFromName(fontMatch[1])
    if (detected) fontHint = detected
  }

  let s = raw
    .replace(/\\U\+([0-9A-Fa-f]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/%%[cC]/g, '⌀')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .replace(/%%%/g, '%')
    .replace(/%%[uUoOkK]/g, '')
    .replace(/\\P/gi, ' ')
    .replace(/\\~|\\\n/g, ' ')
    .replace(/\\S([^;\\{}]*)[\^#/ ]([^;\\{}]*);/g, '$1/$2')
    .replace(/\\S([^;\\{}]*);/g, '$1')
    .replace(/\\[fFhHwWqQtTaAcCpP][^;\\{}]*;/g, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\([{}])/g, '$1')
    .replace(/[{}]/g, '')

  s = tryFixUtf8Mojibake(s)

  const hasNativeVietUnicode = /[\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/.test(s)

  if (!hasNativeVietUnicode) {
    if (fontHint === 'vni') {
      s = convertVniToUnicode(s)
    } else if (fontHint === 'tcvn3' || fontHint === 'tcvn3_upper') {
      s = convertTcvn3ToUnicode(s, fontHint === 'tcvn3_upper')
    } else {
      const isVni =
        /[aAeEoOuUyY\u00D4\u00F4\u00D6\u00F6][\u00F9\u00F8\u00FB\u00F5\u00EF\u00E2\u00E1\u00E0\u00E5\u00E3\u00E4\u00EA\u00E9\u00E8\u00EB\u00EC\u00ED\u00D9\u00D8\u00DB\u00D5\u00CF\u00C2\u00C1\u00C0\u00C5\u00C3\u00C4\u00CA\u00C9\u00C8\u00CB\u00CC\u00CD]/.test(
          s
        ) ||
        /[\u00D1\u00F1][aAeEiIoOuUyY\u00D4\u00F4\u00D6\u00F6]/.test(s)

      const isTcvn3 =
        /[\u00A1-\u00AE\u00B5-\u00BE\u00C6\u00C7\u00CB\u00CE\u00CF\u00D0\u00D1\u00D5-\u00DE\u00DF\u00E4-\u00EE\u00F1\u00F5-\u00FE]/.test(
          s
        ) ||
        /\b(?:Phßng|phßng|Kh¸ch|kh¸ch|BÕp|bÕp|Ngñ|ngñ|TÇng|tÇng|MÆt|mÆt|B»ng|b»ng|T­êng|t­êng|Cöa|cöa|Sµn|sµn|Nhµ|nhµ|VÖ|vÖ|TrÇn|trÇn|M¸i|m¸i|Cét|cét|DÇm|dÇm)/i.test(
          s
        )

      if (isTcvn3) {
        s = convertTcvn3ToUnicode(s)
      } else if (isVni) {
        s = convertVniToUnicode(s)
      }
    }
  }

  return s
}

/**
 * Bảng ánh xạ font thông dụng trong các bản vẽ AutoCAD Việt Nam sang các font Unicode chuẩn
 */
export const VIETNAMESE_CAD_FONT_MAPPINGS: Record<string, string> = {
  // Font TCVN3 / ABC
  vntime: 'Arial',
  'vntime.shx': 'simplex',
  vntimeh: 'Arial',
  'vntimeh.shx': 'simplex',
  '.vntime': 'Arial',
  '.vntimeh': 'Arial',
  '.vnarial': 'Arial',
  '.vnarialh': 'Arial',
  '.vncentury': 'Times New Roman',
  '.vncourier': 'Courier New',
  '.vnavo': 'Arial',
  vnarial: 'Arial',
  'vnarial.shx': 'simplex',
  vnarialh: 'Arial',
  'vnarialh.shx': 'simplex',
  vncooper: 'Arial',
  'vncooper.shx': 'simplex',
  vnsimli: 'Arial',
  'vnsimli.shx': 'simplex',
  vnsimple: 'Arial',
  'vnsimple.shx': 'simplex',
  vn_tcvn: 'Arial',
  'vn_tcvn.shx': 'simplex',
  abc: 'Arial',
  'abc.shx': 'simplex',

  // Font VNI-Windows
  'vni-times': 'Times New Roman',
  'vni-helve': 'Arial',
  'vni-helveh': 'Arial',
  'vni-avo': 'Arial',
  'vni-arial': 'Arial',
  'vni-cooper': 'Arial',
  'vni-aptima': 'Arial',
  vni: 'Arial',
  'vni.shx': 'simplex',
  'vni_vni.shx': 'simplex',
  'vnitimes.shx': 'simplex',
  'vnihelve.shx': 'simplex',

  // Font AutoCAD tiêu chuẩn
  romans: 'simplex',
  'romans.shx': 'simplex',
  romand: 'simplex',
  'romand.shx': 'simplex',
  txt: 'simplex',
  'txt.shx': 'simplex',
  'simplex.shx': 'simplex',
  'complex.shx': 'simplex',
  'italic.shx': 'simplex',
  'bigfont.shx': 'simplex',
}

/**
 * Cấu hình hệ thống Font tiếng Việt cho @mlightcad DocManager và FontManager
 */
export async function applyVietnameseFontConfiguration(manager: AcApDocManager): Promise<void> {
  try {
    // 1. Áp dụng bảng ánh xạ font tiếng Việt
    FontManager.instance.setFontMapping(VIETNAMESE_CAD_FONT_MAPPINGS)

    // 2. Thiết lập chuỗi font dự phòng ưu tiên hiển thị Unicode tiếng Việt
    FontManager.instance.setDefaultFonts(['Arial', 'Times New Roman', 'SimSun', 'hztxt', 'simplex'])

    // 3. Đưa mapping vào view renderer nếu đã khởi tạo
    const view = manager.curView
    if (view && (view as unknown as { renderer?: { setFontMapping?: (m: Record<string, string>) => void } }).renderer?.setFontMapping) {
      ;(view as unknown as { renderer: { setFontMapping: (m: Record<string, string>) => void } }).renderer.setFontMapping(
        VIETNAMESE_CAD_FONT_MAPPINGS
      )
    }

    // 4. Nạp font Unicode chuẩn từ CDN / FontLoader
    await manager.loadFonts(['Arial', 'Times New Roman'])
  } catch (err) {
    console.warn('Lưu ý khi cấu hình Font tiếng Việt:', err)
  }
}

/**
 * Quét toàn bộ Text và MText trong cơ sở dữ liệu CAD để chuyển mã tiếng Việt tự động sang Unicode
 */
export function normalizeVietnameseDatabaseText(db: AcDbDatabase): number {
  let updatedCount = 0
  try {
    const processSpace = (space: unknown) => {
      const s = space as { newIterator?: () => Iterable<unknown> }
      if (!s || typeof s.newIterator !== 'function') return
      for (const ent of s.newIterator()) {
        try {
          if (ent instanceof AcDbText) {
            const raw = ent.textString || ''
            const fontHint = detectFontEncodingFromName((ent as unknown as { textStyle?: { name?: string } }).textStyle?.name || '')
            const decoded = decodeVietnameseCadText(raw, fontHint)
            if (decoded && decoded !== raw) {
              ent.textString = decoded
              updatedCount++
            }
          } else if (ent instanceof AcDbMText) {
            const raw = ent.contents || ''
            const fontHint = detectFontEncodingFromName((ent as unknown as { textStyle?: { name?: string } }).textStyle?.name || '')
            const decoded = decodeVietnameseCadText(raw, fontHint)
            if (decoded && decoded !== raw) {
              ent.contents = decoded
              updatedCount++
            }
          }
        } catch {
          // ignore
        }
      }
    }

    processSpace(db.tables?.blockTable?.modelSpace)

    if (db.tables?.blockTable?.newIterator) {
      for (const btr of db.tables.blockTable.newIterator()) {
        if (btr !== db.tables?.blockTable?.modelSpace) {
          processSpace(btr)
        }
      }
    }
  } catch {
    // ignore
  }
  return updatedCount
}

/**
 * Nạp tệp font người dùng cung cấp (.shx, .ttf, .woff, .otf) vào bộ nhớ đệm font CAD (IndexedDB)
 */
export async function cacheCustomFontFile(
  file: File
): Promise<{ success: boolean; fontName: string; message: string }> {
  try {
    const fileName = file.name
    const baseName = fileName.replace(/\.[^/.]+$/, '')
    const aliases = [baseName, baseName.toLowerCase(), baseName.toUpperCase(), fileName, fileName.toLowerCase()]

    const status = await FontManager.instance.cacheFont(file, fileName, aliases)
    return {
      success: true,
      fontName: status?.fontName || fileName,
      message: `Đã nạp và lưu thành công font "${fileName}" vào bộ nhớ CAD.`,
    }
  } catch (err) {
    return {
      success: false,
      fontName: file.name,
      message: `Không thể nạp font: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
