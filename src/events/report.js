import PacketHeader from '../core/enums/packetHeader.js'
import ReportCode from '../core/enums/reportCode.js'
import Event from '../core/event.js'

class Report extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.REPORT,
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

      let reportMessage = ''

      switch (code) {
        case ReportCode.REPORT_CODE_DETECT_SUSPEND_PROCESS:
          {
            reportMessage = `AntiDebug: Process suspend detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_HARDWARE_DEBUG_REGISTERS:
          {
            reportMessage = `AntiDebug: Hardware debug register detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_NT_QUERY_INFORMATION_PROCESS:
          {
            reportMessage = `AntiDebug: NTQueryInformationProcess detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_NT_GLOBAL_FLAG:
          {
            reportMessage = `AntiDebug: NTGlobalFlag detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_REMOTE_DEBUGGER_PRESENT:
          {
            reportMessage = `AntiDebug: RemoteDebuggerPresent detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_IS_DEBUGGER_PRESENT:
          {
            reportMessage = `AntiDebug: IsDebuggerPresent detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_BEING_DEBUGGED_PEB:
          {
            reportMessage = `AntiDebug: Being debugged PEB detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_DBG_PRINT_RAISE_EXCEPTION:
          {
            reportMessage = `AntiDebug: DBG print raise detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_SET_DEBUG_FILTER_STATE:
          {
            reportMessage = `AntiDebug: Set debug filter state detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_WRITTEN_PAGES:
          {
            reportMessage = `AntiDebug: Written pages detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_UNHANDLED_EXCEPTION_FILTER:
          {
            reportMessage = `AntiDebug: Unhandled exception filter detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_CLOSE_HANDLE_EXCEPTION_TRAP:
          {
            reportMessage = `Trap: Close handle exception trap detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_PREFIX_HOP_TRAP:
          {
            reportMessage = `Trap: Prefix hop trap detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_INT2D_DEBUG_TRAP:
          {
            reportMessage = `Trap: INT2D debug trap detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_INT3D_DEBUG_TRAP:
          {
            reportMessage = `Trap: INT3D debug trap detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_DEBUG_BREAK_TRAP:
          {
            reportMessage = `Trap: Debug break trap detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_INTEL_ICE_TRAP:
          {
            reportMessage = `Trap: Intel ICE trap detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_STACK_SEGMENT_REGISTER_TRAP:
          {
            reportMessage = `Trap: Stack segment register trap detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_POPF_TRAP:
          {
            reportMessage = `Trap: POPF trap detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_MEMORY_BREAKBPOINT_C3:
          {
            reportMessage = `AntiDebug: Memory breakpoint detected 0xC3`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_MEMORY_BREAKBPOINT_2D:
          {
            reportMessage = `AntiDebug: Memory breakpoint detected 0x2D`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_MEMORY_BREAKBPOINT_F1:
          {
            reportMessage = `AntiDebug: Memory breakpoint detected 0xF1`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_VMPROTECT_IS_DEBUGGER_PRESENT:
          {
            reportMessage = `VMProtect: IsDebuggerPresent detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_VMPROTECT_IS_VALID_IMAGE_CRC:
          {
            reportMessage = `VMProtect: IsValidImageCRC detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_CHECK_PREFETCH_FOLDER:
          {
            reportMessage = `InteractiveCheck: CheckPrefetchFolder detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_CHECK_PROCESS:
          {
            reportMessage = `InteractiveCheck: CheckProcess detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_CHECK_WINDOW_TITLE_AND_CLASS:
          {
            reportMessage = `InteractiveCheck: CheckWindowTitleAndClass detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_LAST_PONG_TIME_HIGH:
          {
            reportMessage = `AntiDebug: Client pong time so high maybe time manipulation`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_CONSOLE_CTRL_C_EVENT:
          {
            reportMessage = `AntiDebug: Debug console CTRL + C event detected`
          }
          break
        case ReportCode.REPORT_CODE_DETECT_CONSOLE_BREAK_EVENT:
          {
            reportMessage = `AntiDebug: Debug console application break event detected`
          }
          break
        default:
          {
            reportMessage = `Unknown report code(${code}), check payload for extra information`
          }
          break
      }

      this.server.reportLogger.info(reportMessage, {
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

export default Report
