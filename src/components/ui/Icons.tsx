/** Icon set ported from ainize-web IconSet.js (same paths), plus a few marketplace glyphs. */
interface IconProps { width?: number; height?: number; fill?: string; className?: string; title?: string }

export function CopyIcon({ width = 24, height = 24, fill = '#000000', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden><path fill={fill} d="M16 16v6H2V8h6V2h14v14h-6zm0-2h4V4H10v4h6v6zM4 10v10h10V10H4z" /></svg>);
}
export function ArrowLeftIcon({ width = 24, height = 24, fill = '#000000', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden><path fill={fill} d="M12.23 11.95l4.233-4.625c.663-.845.573-2.117-.202-2.84a1.734 1.734 0 0 0-2.404 0L7 11.948l6.857 7.465c.72.781 1.885.781 2.606 0 .716-.786.716-2.055 0-2.84l-4.233-4.625z" /></svg>);
}
export function ArrowRightIcon({ width = 24, height = 24, fill = '#000000', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden><path fill={fill} d="M10.143 4.485c-.775-.724-1.942-.626-2.606.22a2.155 2.155 0 0 0 0 2.62l4.233 4.624-4.233 4.624c-.716.786-.716 2.055 0 2.841.721.781 1.885.781 2.606 0L17 11.95l-6.857-7.464z" /></svg>);
}
export function LogIcon({ width = 16, height = 16, fill = '#8b3eeb', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 14 14" aria-hidden><path fill={fill} fillRule="evenodd" d="M0 1a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1zm0 3a1 1 0 0 1 1-1h8a1 1 0 0 1 0 2H1a1 1 0 0 1-1-1zm1 2a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2H1zm-1 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1zm1 2a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2H1z" clipRule="evenodd" /></svg>);
}
export function ErrorIcon({ width = 16, height = 16, fill = '#e6173e', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 20 20" aria-hidden><path fill={fill} fillRule="evenodd" d="M10 1.667a8.333 8.333 0 1 0 0 16.666 8.333 8.333 0 0 0 0-16.666zm.694 4.444a.694.694 0 1 0-1.388 0v4.861a.694.694 0 0 0 1.389 0v-4.86zm-1.736 7.986a1.042 1.042 0 1 1 2.084 0 1.042 1.042 0 0 1-2.084 0z" clipRule="evenodd" /></svg>);
}
export function OpenWindowIcon({ width = 16, height = 16, fill = '#8b3eeb', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 14 14" aria-hidden><path fill={fill} d="M11.513 1.4L6.399 6.514a.77.77 0 0 0 1.089 1.09L12.6 2.49V4.2a.7.7 0 0 0 1.4 0V.699A.697.697 0 0 0 13.3 0H9.8a.7.7 0 0 0 0 1.4h1.713zM14 8.4V5.072v7.183C14 13.22 13.306 14 12.448 14H1.552C.695 14 0 13.217 0 12.255V1.745C0 .78.694 0 1.552 0h7.472H5.6a.7.7 0 1 1 0 1.4H1.799c-.223 0-.399.21-.399.467v10.266c0 .253.178.467.399.467H12.2c.223 0 .399-.21.399-.467V8.4a.7.7 0 0 1 1.4 0z" /></svg>);
}
export function ManageIcon({ width = 16, height = 16, fill = '#8b3eeb', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 14 14" aria-hidden><path fill={fill} d="M13.536 8.437l-.989-.765c.032-.223.05-.447.05-.672 0-.225-.018-.45-.05-.672l.989-.765c.473-.358.602-.986.304-1.484l-.733-1.17c-.305-.495-.947-.71-1.517-.507l-1.2.42a5.797 5.797 0 0 0-1.243-.678L8.942.976C8.841.406 8.312-.008 7.7 0H6.27c-.613-.008-1.141.407-1.243.976l-.205 1.168c-.443.176-.86.404-1.243.678l-1.162-.42c-.57-.203-1.212.012-1.517.508L.166 4.079a1.121 1.121 0 0 0 .286 1.484l.988.765A4.82 4.82 0 0 0 1.409 7c0 .225.017.45.05.672l-.989.765a1.122 1.122 0 0 0-.304 1.484l.715 1.17c.304.495.946.71 1.516.507l1.2-.42c.382.274.8.502 1.243.677l.205 1.17c.101.568.63.983 1.243.975h1.43c.614.008 1.142-.407 1.243-.976l.205-1.168c.443-.176.86-.404 1.243-.678l1.2.42c.564.193 1.194-.02 1.498-.508l.733-1.169a1.122 1.122 0 0 0-.304-1.484zm-6.533.9C5.63 9.337 4.517 8.291 4.517 7c0-1.29 1.113-2.337 2.486-2.337 1.373 0 2.486 1.046 2.486 2.337 0 1.29-1.113 2.337-2.486 2.337z" /></svg>);
}
export function ArrowForwardIcon({ width = 16, height = 16, fill = '#ffffff', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 0L6.59 1.41L12.17 7H0V9H12.17L6.59 14.59L8 16L16 8L8 0Z" fill={fill} /></svg>);
}
export function StarIcon({ width = 14, height = 14, fill = '#ffffff', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 14 14" fill="none" aria-hidden><path d="M7.00016 10.5556L11.1224 13.5556L9.54461 8.71117L13.6668 5.77783H8.61127L7.00016 0.777832L5.38905 5.77783H0.333496L4.45572 8.71117L2.87794 13.5556L7.00016 10.5556Z" fill={fill} /></svg>);
}
export function CloseIcon({ width = 14, height = 14, fill = '#ffffff', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 14 14" fill="none" aria-hidden><path d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41Z" fill={fill} fillOpacity="0.5" /></svg>);
}
export function CheckIcon({ width = 14, height = 14, fill = '#44a45f', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden><path fill={fill} d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>);
}
export function CertifiedIcon({ width = 12, height = 12, fill = '#8b3eeb', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden><path fill={fill} d="M12 1.5 15 4l3.9-.4.8 3.8L23 9.5l-2 3.3 1.3 3.7-3.6 1.4-1.4 3.6-3.7-1.3L12 22.5l-3.6-2.3-3.7 1.3-1.4-3.6-3.6-1.4 1.3-3.7L1 9.5l3.3-2.1.8-3.8L9 4z" /><path fill="#fff" d="m10.3 15.6-3-3 1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4z" /></svg>);
}
export function ChainIcon({ width = 16, height = 16, fill = '#8b3eeb', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden><path fill={fill} d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 1 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z" /></svg>);
}
export function DownloadIcon({ width = 16, height = 16, fill = '#8b3eeb', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden><path fill={fill} d="M5 20h14v-2H5v2zm7-18-5.5 6H10v6h4V8h3.5L12 2z" /></svg>);
}
export function BranchIcon({ width = 16, height = 16, fill = '#8b3eeb', className }: IconProps) {
  return (<svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden><path fill={fill} d="M17 3a3 3 0 0 0-1 5.83V10a2 2 0 0 1-2 2H9.83A3 3 0 1 0 8 14.17V17a3 3 0 1 0 2 0v-3h4a4 4 0 0 0 4-4V8.83A3 3 0 0 0 17 3zM7 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm0 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM17 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" /></svg>);
}

/** Decorative pattern used on the banner (ainize AinizePattern). */
export function BrandPattern({ width = 371, height = 135, fill = '#ffffff' }: IconProps) {
  return (
    <svg width={width} height={height} fill="none" aria-hidden>
      <g style={{ mixBlendMode: 'overlay' }} opacity="0.15">
        <path fillRule="evenodd" clipRule="evenodd" d="M47.0362 -6.4819C47.0362 -0.672918 42.3271 4.03619 36.5181 4.03619C30.7091 4.03619 26 -0.672918 26 -6.4819C26 -12.2909 30.7091 -17 36.5181 -17C42.3271 -17 47.0362 -12.2909 47.0362 -6.4819ZM67.4882 -12.3254C63.9383 -12.3254 61.0605 -9.44765 61.0605 -5.89772C61.0605 -2.34778 63.9383 0.53001 67.4882 0.53001H101.38C104.93 0.53001 107.808 -2.34778 107.808 -5.89772C107.808 -9.44765 104.93 -12.3254 101.38 -12.3254H67.4882ZM67.4882 46.1084C63.9383 46.1084 61.0605 48.9862 61.0605 52.5362C61.0605 56.0861 63.9383 58.9639 67.4882 58.9639H101.38C104.93 58.9639 107.808 56.0861 107.808 52.5362C107.808 48.9862 104.93 46.1084 101.38 46.1084H67.4882ZM0 23.5C0 19.9101 2.91015 17 6.5 17H66.5C70.0899 17 73 19.9101 73 23.5C73 27.0899 70.0899 30 66.5 30H6.5C2.91015 30 0 27.0899 0 23.5ZM36.5181 62.47C42.3271 62.47 47.0362 57.7609 47.0362 51.9519C47.0362 46.1429 42.3271 41.4338 36.5181 41.4338C30.7091 41.4338 26 46.1429 26 51.9519C26 57.7609 30.7091 62.47 36.5181 62.47ZM105.47 22.735C105.47 28.5439 100.761 33.2531 94.9519 33.2531C89.1429 33.2531 84.4338 28.5439 84.4338 22.735C84.4338 16.926 89.1429 12.2169 94.9519 12.2169C100.761 12.2169 105.47 16.926 105.47 22.735Z" fill={fill} />
        <path fillRule="evenodd" clipRule="evenodd" d="M261.23 22.7725C261.23 28.5815 256.521 33.2906 250.712 33.2906C244.903 33.2906 240.194 28.5815 240.194 22.7725C240.194 16.9635 244.903 12.2544 250.712 12.2544C256.521 12.2544 261.23 16.9635 261.23 22.7725ZM281.681 16.9291C278.131 16.9291 275.253 19.8069 275.253 23.3568C275.253 26.9067 278.131 29.7845 281.681 29.7845H315.572C319.122 29.7845 322 26.9067 322 23.3568C322 19.8069 319.122 16.9291 315.572 16.9291H281.681ZM281.5 75C277.91 75 275 77.9101 275 81.5C275 85.0899 277.91 88 281.5 88H364.5C368.09 88 371 85.0899 371 81.5C371 77.9101 368.09 75 364.5 75H281.5ZM225 52.5C225 48.9101 227.91 46 231.5 46H280.5C284.09 46 287 48.9101 287 52.5C287 56.0899 284.09 59 280.5 59H231.5C227.91 59 225 56.0899 225 52.5ZM250.711 91.7245C256.52 91.7245 261.229 87.0154 261.229 81.2064C261.229 75.3974 256.52 70.6883 250.711 70.6883C244.902 70.6883 240.193 75.3974 240.193 81.2064C240.193 87.0154 244.902 91.7245 250.711 91.7245ZM319.663 51.9895C319.663 57.7984 314.954 62.5076 309.145 62.5076C303.336 62.5076 298.627 57.7984 298.627 51.9895C298.627 46.1805 303.336 41.4714 309.145 41.4714C314.954 41.4714 319.663 46.1805 319.663 51.9895Z" fill={fill} />
        <path fillRule="evenodd" clipRule="evenodd" d="M105.799 22.7725C105.799 28.5815 101.09 33.2906 95.2811 33.2906C89.4721 33.2906 84.763 28.5815 84.763 22.7725C84.763 16.9635 89.4721 12.2544 95.2811 12.2544C101.09 12.2544 105.799 16.9635 105.799 22.7725ZM126.355 16.8333C122.772 16.8333 119.868 19.7376 119.868 23.3202C119.868 26.9027 122.772 29.807 126.355 29.807H218.697C222.279 29.807 225.184 26.9027 225.184 23.3202C225.184 19.7376 222.279 16.8333 218.697 16.8333H126.355ZM126.355 75.3421C122.772 75.3421 119.868 78.2464 119.868 81.8289C119.868 85.4115 122.772 88.3158 126.355 88.3158H181.302C184.885 88.3158 187.789 85.4115 187.789 81.8289C187.789 78.2464 184.885 75.3421 181.302 75.3421H126.355ZM84.7627 52.5738C84.7627 49.0238 87.6405 46.146 91.1904 46.146H125.082C128.632 46.146 131.51 49.0238 131.51 52.5738C131.51 56.1237 128.632 59.0015 125.082 59.0015H91.1904C87.6405 59.0015 84.7627 56.1237 84.7627 52.5738ZM95.2808 91.7245C101.09 91.7245 105.799 87.0154 105.799 81.2064C105.799 75.3974 101.09 70.6883 95.2808 70.6883C89.4718 70.6883 84.7627 75.3974 84.7627 81.2064C84.7627 87.0154 89.4718 91.7245 95.2808 91.7245ZM164.233 51.9895C164.233 57.7984 159.524 62.5076 153.715 62.5076C147.906 62.5076 143.197 57.7984 143.197 51.9895C143.197 46.1805 147.906 41.4714 153.715 41.4714C159.524 41.4714 164.233 46.1805 164.233 51.9895Z" fill={fill} />
      </g>
    </svg>
  );
}
