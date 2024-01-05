import PacketHeader from '../core/enums/packetHeader.js'
import VitalCode from '../core/enums/vitalCode.js'
import Event from '../core/event.js'

class Vital extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.VITAL,
      authorization: false,
      rateLimitOpts: {
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      const code = packet.readUnsignedInt()
      const payload = packet.readString(true)

      let vitalMessage = ''

      switch (code) {
        case VitalCode.VITAL_CODE_INJECTION_INVALID_FILE_ERROR:
          {
            vitalMessage = `Invalid injection dll file`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_INVALID_PLATFORM_ERROR:
          {
            vitalMessage = `Mismatch dll != protess architecture`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_TARGET_PROCESS_MEMORY_ALLOCATION_ERROR:
          {
            vitalMessage = `Target process memory allocation failed`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_CANT_WRITE_FILE_HEADER_ERROR:
          {
            vitalMessage = `Can't write file header`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_CANT_MAP_SECTIONS_ERROR:
          {
            vitalMessage = `Can't map sections`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_TARGET_PROCESS_MAPPING_ALLOCATION_FAILED_ERROR:
          {
            vitalMessage = `Target process mapping allocation failed`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_CANT_WRITE_MAPPING_ERROR:
          {
            vitalMessage = `Can't write mapping`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_MEMORY_SHELLCODE_ALLOCATION_FAILED_ERROR:
          {
            vitalMessage = `Memory shellcode allocation failed`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_CANT_WRITE_SHELLCODE_ERROR:
          {
            vitalMessage = `Can't write shellcode`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_THREAD_CREATION_FAILED_ERROR:
          {
            vitalMessage = `Thread creation failed`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_PROCESS_CRASHED_ERROR:
          {
            vitalMessage = `Process crashed`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_WRONG_MAPPING_PTR_ERROR:
          {
            vitalMessage = `Wrong mapping ptr`
          }
          break
        case VitalCode.VITAL_CODE_INJECTION_SUCCESS:
          {
            vitalMessage = `Injection passed`
          }
          break
        case VitalCode.VITAL_CODE_XIGN_LOADER_START_PROCESS_ERROR:
          {
            vitalMessage = `Xigncode loader failed to start`
          }
          break
        case VitalCode.VITAL_CODE_CLIENT_START_PROCESS_ERROR:
          {
            vitalMessage = `KnightOnline.exe failed to start`
          }
          break
        case VitalCode.VITAL_CODE_CLIENT_PROCESS_EXITED_UNKNOWN_REASON:
          {
            vitalMessage = `KnightOnline.exe closed unknown reason`
          }
          break
        case VitalCode.VITAL_CODE_XIGN_LOADER_NOT_EXITED_NORMALLY:
          {
            vitalMessage = `Xigncode loader not closed normally`
          }
          break
        case VitalCode.VITAL_CODE_XIGN_LOADER_EXIT_CODE_NOT_ZERO:
          {
            vitalMessage = `Xigncode loader exit code not zero`
          }
          break
        case VitalCode.VITAL_CODE_CLIENT_PROCESS_STARTED:
          {
            vitalMessage = `KnightOnline.exe started`
          }
          break
        case VitalCode.VITAL_CODE_XIGN_LOADER_STARTED:
          {
            vitalMessage = `Xigncode loader started`
          }
          break

        default:
          {
            vitalMessage = `Unknown vital code(${code}), check payload for extra information`
          }
          break
      }

      this.server.vitalLogger.info(vitalMessage, {
        code: code,
        payload: payload,
        metadata: this.socket.metadata,
      })
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }
}

export default Vital
