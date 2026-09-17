import os
from PIL import Image, ImageDraw

def cubic_bezier(p0, p1, p2, p3, n=16):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1.0 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts

def get_plane_path():
    points = []
    # M17.8 19.2
    p = (17.8, 19.2)
    points.append(p)
    
    # 16 11
    p = (16.0, 11.0)
    points.append(p)
    
    # l 3.5 -3.5 -> (19.5, 7.5)
    p = (16.0 + 3.5, 11.0 - 3.5)
    points.append(p)
    
    # C 21 6, 21.5 4, 21 3
    points.extend(cubic_bezier(p, (21.0, 6.0), (21.5, 4.0), (21.0, 3.0))[1:])
    p = (21.0, 3.0)
    
    # c -1 -0.5, -3 0, -4.5 1.5 -> abs: (20, 2.5), (18, 3), (16.5, 4.5)
    points.extend(cubic_bezier(p, (p[0]-1.0, p[1]-0.5), (p[0]-3.0, p[1]), (p[0]-4.5, p[1]+1.5))[1:])
    p = (16.5, 4.5)
    
    # L 13 8
    p = (13.0, 8.0)
    points.append(p)
    
    # 4.8 6.2
    p = (4.8, 6.2)
    points.append(p)
    
    # c -.5 -.1, -.9 .1, -1.1 .5
    points.extend(cubic_bezier(p, (p[0]-0.5, p[1]-0.1), (p[0]-0.9, p[1]+0.1), (p[0]-1.1, p[1]+0.5))[1:])
    p = (p[0]-1.1, p[1]+0.5)
    
    # l -.3 .5
    p = (p[0]-0.3, p[1]+0.5)
    points.append(p)
    
    # c -.2 .5, -.1 1, .3 1.3
    points.extend(cubic_bezier(p, (p[0]-0.2, p[1]+0.5), (p[0]-0.1, p[1]+1.0), (p[0]+0.3, p[1]+1.3))[1:])
    p = (p[0]+0.3, p[1]+1.3)
    
    # L 9 12
    p = (9.0, 12.0)
    points.append(p)
    
    # l -2 3
    p = (7.0, 15.0)
    points.append(p)
    
    # H 4
    p = (4.0, 15.0)
    points.append(p)
    
    # l -1 1
    p = (3.0, 16.0)
    points.append(p)
    
    # l 3 2
    p = (6.0, 18.0)
    points.append(p)
    
    # l 2 3
    p = (8.0, 21.0)
    points.append(p)
    
    # l 1 -1
    p = (9.0, 20.0)
    points.append(p)
    
    # v -3
    p = (9.0, 17.0)
    points.append(p)
    
    # l 3 -2
    p = (12.0, 15.0)
    points.append(p)
    
    # l 3.5 5.3
    p = (15.5, 20.3)
    points.append(p)
    
    # c .3 .4, .8 .5, 1.3 .3
    points.extend(cubic_bezier(p, (p[0]+0.3, p[1]+0.4), (p[0]+0.8, p[1]+0.5), (p[0]+1.3, p[1]+0.3))[1:])
    p = (p[0]+1.3, p[1]+0.3)
    
    # l .5 -.2
    p = (p[0]+0.5, p[1]-0.2)
    points.append(p)
    
    # c .4 -.3, .6 -.7, .5 -1.2
    points.extend(cubic_bezier(p, (p[0]+0.4, p[1]-0.3), (p[0]+0.6, p[1]-0.7), (p[0]+0.5, p[1]-1.2))[1:])
    p = (17.8, 19.2)
    points.append(p)
    
    return points

def generate():
    os.makedirs('public', exist_ok=True)
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Brand gradient: top-left to bottom-right (vibrant red/rose to deep ruby red)
    for y in range(size):
        t = y / size
        # #f43f5e (244, 63, 94) to #be123c (190, 18, 60)
        r = int(244 * (1 - t) + 190 * t)
        g = int(63 * (1 - t) + 18 * t)
        b = int(94 * (1 - t) + 60 * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
        
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size-1, size-1)], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)
    
    # Draw plane path
    raw_pts = get_plane_path()
    
    # Scale from 24x24 box to center in 1024
    # Plane occupies ~[3..21] x [3..21] = 18x18
    target_plane_size = size * 0.62
    scale = target_plane_size / 24.0
    offset_x = (size - 24 * scale) / 2.0
    offset_y = (size - 24 * scale) / 2.0
    
    scaled_pts = [(offset_x + pt[0] * scale, offset_y + pt[1] * scale) for pt in raw_pts]
    
    # Draw airplane with subtle drop shadow first
    shadow_offset = int(size * 0.015)
    shadow_pts = [(pt[0], pt[1] + shadow_offset) for pt in scaled_pts]
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.polygon(shadow_pts, fill=(120, 10, 30, 80))
    
    # White plane fill and crisp outline
    overlay_draw.polygon(scaled_pts, fill=(255, 255, 255, 255))
    overlay_draw.line(scaled_pts + [scaled_pts[0]], fill=(255, 255, 255, 255), width=int(scale * 0.5), joint='curve')
    
    # Composite
    img = Image.alpha_composite(img, overlay)
    
    # Save 512x512 master
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save('public/icon-512x512.png', 'PNG')
    
    # Save 192x192
    img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    img_192.save('public/icon-192x192.png', 'PNG')
    
    # Save 180x180 apple-touch-icon
    img_180 = img.resize((180, 180), Image.Resampling.LANCZOS)
    img_180.save('public/apple-touch-icon.png', 'PNG')
    
    # Save 32x32 favicon
    img_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
    img_32.save('public/favicon-32x32.png', 'PNG')
    
    # Save 16x16 favicon
    img_16 = img.resize((16, 16), Image.Resampling.LANCZOS)
    img_16.save('public/favicon-16x16.png', 'PNG')
    
    # Save 48x48
    img_48 = img.resize((48, 48), Image.Resampling.LANCZOS)
    
    # Save multi-res favicon.ico containing 16x16, 32x32, 48x48
    img.save('public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    
    print('All favicon PNG and ICO files generated successfully.')

if __name__ == '__main__':
    generate()
